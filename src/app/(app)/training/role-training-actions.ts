"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";

export type BuildState = {
  error: string | null;
  program?: GeneratedProgram; // preview from generate (not yet saved)
  built?: { hospitality: number; role: number }; // result after save
};

type GeneratedProgram = {
  hospitality_items: string[];
  role_items: string[];
  track_label?: string;
};

const LIST_TABLE = {
  hospitality: "department_standards",
  role: "department_training_items",
} as const;
const LIST_ITEM_TYPE = { hospitality: "standard", role: "training" } as const;
type ListKey = keyof typeof LIST_TABLE;

function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
}

function extractJsonObject(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

// Parse the model's JSON response with friendly errors instead of a raw
// "Unexpected end of JSON input" when the output is empty or truncated.
async function parseGeneratedResponse(response: Response): Promise<GeneratedProgram> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
  if (!text) {
    throw new Error("The AI couldn't read that file. If it's a scanned image, try a text-based PDF or a clear photo — or use the guided builder instead.");
  }
  try {
    return JSON.parse(extractJsonObject(text)) as GeneratedProgram;
  } catch {
    if (data.stop_reason === "max_tokens") {
      throw new Error("That document was too long to process in one pass. Try uploading fewer pages, or use the guided builder.");
    }
    throw new Error("Couldn't read a complete program from that file. Try a clearer or shorter PDF, or use the guided builder.");
  }
}

const SYSTEM_PROMPT = `You are an elite hospitality training designer who builds world-class, role-specific training programs for restaurants -- the kind a great operator would be proud to run. Guest experience is woven into every role, and every item is a concrete behavior a manager can watch for. For any guest-facing role, always include at least one suggestive-selling behavior and one guest-recovery behavior built on the guided-influence structure; for roles that shape the room (Host, Manager, Chef, Bartender), include the physical environment as part of the job. For EVERY role, include at least one purpose-and-pride behavior -- naming why this role matters to the guest and the team, and taking genuine ownership and pride in the craft -- because morale and workplace pride (the In-N-Out / Chick-fil-A effect) are the engine behind both guest experience and staff retention. Order the hospitality behaviors along the guest's journey -- greeting and first impression, discovery and personalization, guiding and selling, the check, then a warm goodbye that sets up the next visit -- so the program reads as a journey a guest actually travels, not a random list.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly, with no markdown fences and no commentary outside the JSON object.`;

const RESPONSE_SHAPE = `{"hospitality_items": [string], "role_items": [string], "track_label": string}`;

export async function generateRoleTraining(_prev: BuildState, formData: FormData): Promise<BuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) {
    return { error: "You don't have access to generate training content." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const department = String(formData.get("department") || "");
  const mode = String(formData.get("mode") || "");
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (mode !== "upload" && mode !== "paste" && mode !== "wizard") return { error: "Invalid mode." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };
  }

  let generated: GeneratedProgram;
  try {
    if (mode === "upload") {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Choose an existing training document (PDF or image) first." };
      if (file.size > 10 * 1024 * 1024) return { error: "File is too large -- 10MB max." };
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) return { error: "Upload a PDF or image (JPG/PNG) of the existing training material." };

      const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes } }
        : { type: "image", source: { type: "base64", media_type: file.type, data: bytes } };

      const prompt = `This is an existing training document or handbook page for a restaurant's ${department} role. Read everything in it.

Your job:
1. Extract every concrete, checkable standard already described in this document, split into two buckets:
   - "hospitality_items": guest-experience and hospitality behaviors -- recognition, personalization, service recovery, guiding the guest -- as they apply to this role.
   - "role_items": role-specific technical/operational skills unique to being a great ${department} (POS steps, food safety, pour specs, seating logic, etc.) that aren't primarily about the guest interaction itself.
2. Then ADD any additional items you'd recommend from hospitality and guest-experience best practices that are missing from the document, so the result is a complete, best-practice ${department} training program, not just a transcription.
3. Keep every item under 16 words, phrased as a concrete observable action a manager could watch for and check off.
4. Propose a short track_label (2-4 words) naming this role's specific skill track, e.g. "Steps of Service" or "Bar & Beverage Program".

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${RESPONSE_SHAPE}`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      });
      generated = await parseGeneratedResponse(response);
    } else if (mode === "paste") {
      const pastedText = String(formData.get("pastedText") || "").trim();
      if (!pastedText) return { error: "Paste your existing training text first." };
      if (pastedText.length > 30000) return { error: "That's a lot of text — trim it to the essentials (30,000 characters max)." };

      const prompt = `Below is existing training text or handbook material for a restaurant's ${department} role. Read all of it.

Your job:
1. Extract every concrete, checkable standard already described in the text, split into two buckets:
   - "hospitality_items": guest-experience and hospitality behaviors -- recognition, personalization, service recovery, guiding the guest -- as they apply to this role.
   - "role_items": role-specific technical/operational skills unique to being a great ${department} (POS steps, food safety, pour specs, seating logic, etc.) that aren't primarily about the guest interaction itself.
2. Then ADD any additional items you'd recommend from hospitality and guest-experience best practices that are missing, so the result is a complete, best-practice ${department} training program, not just a transcription.
3. Keep every item under 16 words, phrased as a concrete observable action a manager could watch for and check off.
4. Propose a short track_label (2-4 words) naming this role's specific skill track, e.g. "Steps of Service" or "Bar & Beverage Program".

TRAINING TEXT:
"""
${pastedText}
"""

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${RESPONSE_SHAPE}`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      generated = await parseGeneratedResponse(response);
    } else {
      const qa: string[] = [];
      let qi = 0;
      while (formData.has(`question_${qi}`)) {
        const q = String(formData.get(`question_${qi}`) || "").trim();
        const a = String(formData.get(`answer_${qi}`) || "").trim();
        if (q) qa.push(`Q: ${q}\nA: ${a || "not specified, infer from the role"}`);
        qi++;
      }

      const prompt = `Build a complete training program from scratch for a restaurant's ${department} role, based on the operator's own answers below.

${qa.join("\n\n")}

Generate:
- "hospitality_items": 6-8 guest-experience and hospitality behaviors for this role -- recognition, personalization, service recovery, guiding the guest -- reflecting the operator's input above.
- "role_items": 6-8 role-specific technical/operational skills unique to being a great ${department}.
- "track_label": a short (2-4 word) name for this role's specific skill track.

Every item under 16 words, phrased as a concrete observable action a manager could watch for and check off, not a vague value statement.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${RESPONSE_SHAPE}`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      generated = await parseGeneratedResponse(response);
    }

    if (!Array.isArray(generated.hospitality_items) || !Array.isArray(generated.role_items)) {
      throw new Error("The generator returned an incomplete response. Try again.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Training generation failed. Try again." };
  }

  // Return the preview for review — nothing is saved until saveRoleTraining().
  return { error: null, program: generated };
}

// Persist the reviewed program. Replaces this department's previous AI/upload
// output (source = 'wingman') but leaves hand-typed 'custom' items untouched.
export async function saveRoleTraining(
  department: string,
  hospitalityItems: string[],
  roleItems: string[],
  trackLabel?: string
): Promise<BuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) {
    return { error: "You don't have access to save training content." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const hospitality = hospitalityItems.map((s) => String(s).trim()).filter(Boolean);
  const role = roleItems.map((s) => String(s).trim()).filter(Boolean);
  if (hospitality.length === 0 && role.length === 0) return { error: "Nothing to save — add at least one item." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { data: oldStandards } = await supabase
    .from("department_standards")
    .select("id")
    .eq("org_id", org.id)
    .eq("department", department)
    .eq("source", "wingman");
  const { data: oldTraining } = await supabase
    .from("department_training_items")
    .select("id")
    .eq("org_id", org.id)
    .eq("department", department)
    .eq("source", "wingman");

  const oldStandardIds = (oldStandards ?? []).map((r) => r.id);
  const oldTrainingIds = (oldTraining ?? []).map((r) => r.id);
  if (oldStandardIds.length > 0) {
    await supabase.from("staff_training_progress").delete().eq("item_type", "standard").in("item_id", oldStandardIds);
  }
  if (oldTrainingIds.length > 0) {
    await supabase.from("staff_training_progress").delete().eq("item_type", "training").in("item_id", oldTrainingIds);
  }

  await supabase.from("department_standards").delete().eq("org_id", org.id).eq("department", department).eq("source", "wingman");
  await supabase.from("department_training_items").delete().eq("org_id", org.id).eq("department", department).eq("source", "wingman");

  const { count: standardsBase } = await supabase
    .from("department_standards")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);
  const { count: trainingBase } = await supabase
    .from("department_training_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);

  if (hospitality.length > 0) {
    const { error } = await supabase.from("department_standards").insert(
      hospitality.map((item, i) => ({ org_id: org.id, department, item, sort_order: (standardsBase ?? 0) + i, source: "wingman" }))
    );
    if (error) return { error: error.message };
  }
  if (role.length > 0) {
    const { error } = await supabase.from("department_training_items").insert(
      role.map((item, i) => ({ org_id: org.id, department, item, sort_order: (trainingBase ?? 0) + i, source: "wingman" }))
    );
    if (error) return { error: error.message };
  }
  if (trackLabel) {
    await supabase.from("department_meta").update({ track_label: trackLabel }).eq("org_id", org.id).eq("department", department);
  }

  revalidatePath("/training");
  return { error: null, built: { hospitality: hospitality.length, role: role.length } };
}

export type ItemState = { error: string | null };

export async function addChecklistItem(_prev: ItemState, formData: FormData): Promise<ItemState> {
  const department = String(formData.get("department") || "");
  const list = String(formData.get("list") || "") as ListKey;
  const text = String(formData.get("text") || "").trim();
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!LIST_TABLE[list]) return { error: "Invalid list." };
  if (!text) return { error: "Item text is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const table = LIST_TABLE[list];
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);

  const { error } = await supabase.from(table).insert({
    org_id: org.id,
    department,
    item: text,
    sort_order: count ?? 0,
    source: "custom",
  });
  if (error) return { error: error.message };

  revalidatePath("/training");
  return { error: null };
}

export async function updateChecklistItemText(list: ListKey, id: string, text: string) {
  const supabase = await createClient();
  await supabase.from(LIST_TABLE[list]).update({ item: text }).eq("id", id);
  revalidatePath("/training");
}

// ---------------------------------------------------------------------------
// Refine with AI: the owner describes changes in plain English and Wingman
// proposes a set of add/edit/remove changes to the CURRENT program. Nothing is
// written until the owner accepts (see applyTrainingRefinement).
// ---------------------------------------------------------------------------
export type TrainingChange = { list: ListKey; id?: string; item: string; before?: string; reason: string };
export type TrainingProposal = { summary: string; add: TrainingChange[]; edit: TrainingChange[]; remove: TrainingChange[] };
export type RefineState = { error: string | null; proposal?: TrainingProposal };

const REFINE_SHAPE = `{"summary": string, "add": [{"list": "hospitality"|"role", "item": string, "reason": string}], "edit": [{"id": string, "item": string, "reason": string}], "remove": [{"id": string, "reason": string}]}`;

export async function refineTraining(_prev: RefineState, formData: FormData): Promise<RefineState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) {
    return { error: "You don't have access to edit training content." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const department = String(formData.get("department") || "");
  const feedback = String(formData.get("feedback") || "").trim();
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!feedback) return { error: "Tell Wingman what you'd like to change or add." };
  if (feedback.length > 2000) return { error: "Please keep your request under 2000 characters." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const [{ data: hosp }, { data: role }] = await Promise.all([
    supabase.from(LIST_TABLE.hospitality).select("id, item").eq("org_id", org.id).eq("department", department).order("sort_order"),
    supabase.from(LIST_TABLE.role).select("id, item").eq("org_id", org.id).eq("department", department).order("sort_order"),
  ]);
  const byId = new Map<string, { list: ListKey; item: string }>();
  for (const r of (hosp ?? []) as { id: string; item: string }[]) byId.set(r.id, { list: "hospitality", item: r.item });
  for (const r of (role ?? []) as { id: string; item: string }[]) byId.set(r.id, { list: "role", item: r.item });

  const currentForModel = [...byId.entries()].map(([id, v]) => ({ id, list: v.list, item: v.item }));

  const prompt = `You are helping a restaurant operator improve their existing ${department} training program based on their request.

CURRENT PROGRAM ITEMS (JSON — "list" is "hospitality" for guest-experience behaviors or "role" for role-specific technical skills):
${JSON.stringify(currentForModel)}

THE OWNER'S REQUEST:
"${feedback}"

Respond helpfully to what they asked. You can do any combination of:
- "add": propose brand-new items. Set "list" to exactly "hospitality" or "role". Be generous here — if they ask to add something, ask for suggestions/ideas, or ask an open question ("what am I missing?"), propose 3-6 strong, concrete new items. Don't hold back.
- "edit": improve the wording of an existing item by its "id" (put the improved text in "item").
- "remove": remove an existing item by its "id".

Only "edit" or "remove" items whose "id" appears in the current program above. Every item stays under 16 words and is a concrete, observable action a manager can watch for and check off — never a vague value statement. Always propose at least one change unless the program already fully covers the request. Give a one-line "reason" for each change, and a one-sentence "summary" of the whole proposal.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${REFINE_SHAPE}`;

  let parsed: {
    summary?: string;
    add?: { list?: string; item?: string; reason?: string }[];
    edit?: { id?: string; item?: string; reason?: string }[];
    remove?: { id?: string; reason?: string }[];
  };
  try {
    const response = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    const jsonText = extractJsonObject(text);
    try {
      parsed = jsonText ? JSON.parse(jsonText) : {};
    } catch {
      return { error: "Wingman couldn't turn that into changes — try a shorter, more specific request." };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate suggestions. Try again." };
  }

  // Validate the model's output against what actually exists; ignore anything
  // that references an unknown id or an invalid list, so the proposal can only
  // ever touch this department's real items.
  const clip = (s: string) => s.trim().slice(0, 200);
  // Match the model's "list" leniently: it sometimes returns "hospitality_items"
  // or capitalized variants. Default an unrecognized list to "role".
  const normList = (l: unknown): ListKey => (String(l ?? "").toLowerCase().includes("hosp") ? "hospitality" : "role");
  const add: TrainingChange[] = [];
  for (const a of parsed.add ?? []) {
    const item = clip(String(a.item ?? ""));
    if (item) add.push({ list: normList(a.list), item, reason: clip(String(a.reason ?? "")) });
  }
  const edit: TrainingChange[] = (parsed.edit ?? [])
    .filter((e) => e.id && byId.has(String(e.id)) && String(e.item ?? "").trim())
    .map((e) => {
      const cur = byId.get(String(e.id))!;
      return { list: cur.list, id: String(e.id), item: clip(String(e.item)), before: cur.item, reason: clip(String(e.reason ?? "")) };
    });
  const remove: TrainingChange[] = (parsed.remove ?? [])
    .filter((r) => r.id && byId.has(String(r.id)))
    .map((r) => {
      const cur = byId.get(String(r.id))!;
      return { list: cur.list, id: String(r.id), item: cur.item, reason: clip(String(r.reason ?? "")) };
    });

  if (add.length === 0 && edit.length === 0 && remove.length === 0) {
    return { error: "Wingman didn't find anything to change for that request. Try rephrasing what you'd like." };
  }

  return { error: null, proposal: { summary: clip(String(parsed.summary ?? "Proposed changes")), add, edit, remove } };
}

// Apply an owner-approved proposal. Re-validates every id against the DB, so a
// tampered payload can still only add/edit/remove this department's own items.
export async function applyTrainingRefinement(department: string, proposal: TrainingProposal): Promise<ItemState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) {
    return { error: "You don't have access to edit training content." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const [{ data: hosp }, { data: role }] = await Promise.all([
    supabase.from(LIST_TABLE.hospitality).select("id").eq("org_id", org.id).eq("department", department),
    supabase.from(LIST_TABLE.role).select("id").eq("org_id", org.id).eq("department", department),
  ]);
  const validList = new Map<string, ListKey>();
  for (const r of (hosp ?? []) as { id: string }[]) validList.set(r.id, "hospitality");
  for (const r of (role ?? []) as { id: string }[]) validList.set(r.id, "role");

  const clip = (s: string) => String(s ?? "").trim().slice(0, 200);

  // Removes first, then edits, then adds.
  for (const r of proposal.remove ?? []) {
    const list = validList.get(String(r.id));
    if (!r.id || !list) continue;
    await supabase.from("staff_training_progress").delete().eq("item_type", LIST_ITEM_TYPE[list]).eq("item_id", r.id);
    await supabase.from(LIST_TABLE[list]).delete().eq("id", r.id).eq("org_id", org.id);
  }
  for (const e of proposal.edit ?? []) {
    const list = validList.get(String(e.id));
    const item = clip(e.item);
    if (!e.id || !list || !item) continue;
    await supabase.from(LIST_TABLE[list]).update({ item }).eq("id", e.id).eq("org_id", org.id);
  }
  for (const list of ["hospitality", "role"] as ListKey[]) {
    const adds = (proposal.add ?? []).filter((a) => a.list === list && clip(a.item));
    if (adds.length === 0) continue;
    const { count } = await supabase
      .from(LIST_TABLE[list])
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("department", department);
    let sort = count ?? 0;
    const rows = adds.map((a) => ({ org_id: org.id, department, item: clip(a.item), sort_order: sort++, source: "custom" }));
    const { error } = await supabase.from(LIST_TABLE[list]).insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/training");
  return { error: null };
}

export async function deleteChecklistItem(list: ListKey, id: string) {
  const supabase = await createClient();
  await supabase.from("staff_training_progress").delete().eq("item_type", LIST_ITEM_TYPE[list]).eq("item_id", id);
  await supabase.from(LIST_TABLE[list]).delete().eq("id", id);
  revalidatePath("/training");
}
