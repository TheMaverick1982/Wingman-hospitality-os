"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";

export type BuildState = { error: string | null; traits?: GeneratedTrait[]; built?: number };

export type GeneratedTrait = { title: string; question: string; green_flag: string; red_flag: string };

function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

function extractJsonArray(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("[");
  const last = cleaned.lastIndexOf("]");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

// Parse the model's JSON-array response with friendly errors instead of a raw
// "Unexpected end of JSON input" when the output is empty or truncated.
async function parseGeneratedArray(response: Response): Promise<unknown[]> {
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
    throw new Error("The AI couldn't read that file. If it's a scanned image, try a text-based PDF or a clear photo — or paste the text instead.");
  }
  try {
    const parsed = JSON.parse(extractJsonArray(text));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    if (data.stop_reason === "max_tokens") {
      throw new Error("That document was too long to process in one pass. Try fewer pages, or paste the key parts.");
    }
    throw new Error("Couldn't read a complete set from that file. Try a clearer or shorter PDF, or paste the text instead.");
  }
}

const SYSTEM_PROMPT = `You are an elite restaurant hiring architect. Your job is to help operators screen for the person, not the resume: hospitality instinct, coachability, resilience under pressure, and a genuine guest-first mindset predict success far more than years of experience. You screen hardest for candidates who instinctively create connection and reactions, weighing role competence alongside. Every trait must be checkable through a real interview question with a concrete green flag (what a good answer sounds like) and a red flag (what a concerning answer sounds like) -- never vague adjectives -- and include at least one trait that surfaces what genuinely drives the candidate and whether it aligns with the role.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly, no markdown fences, no commentary outside the JSON.`;

const RESPONSE_SHAPE = `[{"title": string, "question": string, "green_flag": string, "red_flag": string}]`;

export async function generateHiringCriteria(_prev: BuildState, formData: FormData): Promise<BuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) {
    return { error: "You don't have access to generate hiring criteria." };
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

  let traits: GeneratedTrait[];
  try {
    if (mode === "upload") {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Choose an existing interview guide or scorecard (PDF or image) first." };
      if (file.size > 10 * 1024 * 1024) return { error: "File is too large -- 10MB max." };
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) return { error: "Upload a PDF or image (JPG/PNG) of the existing interview guide." };

      const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes } }
        : { type: "image", source: { type: "base64", media_type: file.type, data: bytes } };

      const prompt = `This is an existing interview guide, scorecard, or hiring criteria document for a restaurant's ${department} role. Read everything in it.

Your job:
1. Extract every trait or question already used to screen ${department} candidates, and turn each into a structured entry: a short trait title, the actual interview question, a green flag (what a good answer sounds like), and a red flag (what a concerning answer sounds like).
2. Then ADD any traits missing that would help find someone who's genuinely a fit for this role -- not just experienced -- weighing characteristics (hospitality instinct, coachability, resilience, guest-first mindset, teamwork under pressure) alongside role-specific competence.
3. Keep every field concrete and interview-usable, not a vague value statement.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${RESPONSE_SHAPE}`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      });
      traits = (await parseGeneratedArray(response)) as GeneratedTrait[];
    } else if (mode === "paste") {
      const pastedText = String(formData.get("pastedText") || "").trim();
      if (!pastedText) return { error: "Paste your existing interview guide or criteria first." };
      if (pastedText.length > 30000) return { error: "That's a lot of text — trim it to the essentials (30,000 characters max)." };

      const prompt = `Below is an existing interview guide, scorecard, or hiring criteria for a restaurant's ${department} role. Read all of it.

Your job:
1. Extract every trait or question already used to screen ${department} candidates, and turn each into a structured entry: a short trait title, the actual interview question, a green flag (what a good answer sounds like), and a red flag (what a concerning answer sounds like).
2. Then ADD any traits missing that would help find someone who's genuinely a fit for this role -- not just experienced -- weighing characteristics (hospitality instinct, coachability, resilience, guest-first mindset, teamwork under pressure) alongside role-specific competence.
3. Keep every field concrete and interview-usable, not a vague value statement.

HIRING TEXT:
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
      traits = (await parseGeneratedArray(response)) as GeneratedTrait[];
    } else {
      const hardToFill = String(formData.get("hardToFill") || "").trim();
      const pastMiss = String(formData.get("pastMiss") || "").trim();
      const successTraits = String(formData.get("successTraits") || "").trim();

      const prompt = `Build a complete hiring-screening criteria set from scratch for a restaurant's ${department} role.

What roles/shifts are hardest to fill or keep staffed: ${hardToFill || "not specified"}
A past hire who looked good on paper (experienced) but wasn't actually a fit -- what was missing: ${pastMiss || "not specified"}
What characteristics the operator believes actually predict success in this role, beyond experience: ${successTraits || "not specified, infer from the role"}

Generate 6-8 traits to screen ${department} candidates for, weighing hospitality/guest-first characteristics alongside role-specific competence. Each trait needs: a short title, a real interview question, a green flag (what a good answer sounds like), and a red flag (what a concerning answer sounds like).

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${RESPONSE_SHAPE}`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      traits = (await parseGeneratedArray(response)) as GeneratedTrait[];
    }

    if (!Array.isArray(traits) || traits.length === 0) {
      throw new Error("The generator returned an incomplete response. Try again.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Hiring criteria generation failed. Try again." };
  }

  // Return the preview for review — nothing is saved until saveHiringCriteria().
  return { error: null, traits };
}

// Persist the reviewed traits, replacing this department's previous AI output.
export async function saveHiringCriteria(department: string, traits: GeneratedTrait[]): Promise<BuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) {
    return { error: "You don't have access to save hiring criteria." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const clean = (traits ?? [])
    .map((t) => ({
      title: String(t.title ?? "").trim(),
      question: String(t.question ?? "").trim(),
      green_flag: String(t.green_flag ?? "").trim(),
      red_flag: String(t.red_flag ?? "").trim(),
    }))
    .filter((t) => t.title || t.question);
  if (clean.length === 0) return { error: "Nothing to save — keep at least one trait." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  await supabase.from("hiring_traits").delete().eq("org_id", org.id).eq("department", department).eq("source", "wingman");

  const { count: base } = await supabase
    .from("hiring_traits")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);

  const { error } = await supabase.from("hiring_traits").insert(
    clean.map((t, i) => ({
      org_id: org.id,
      department,
      title: t.title,
      question: t.question,
      green_flag: t.green_flag,
      red_flag: t.red_flag,
      sort_order: (base ?? 0) + i,
      source: "wingman",
    }))
  );
  if (error) return { error: error.message };

  revalidatePath("/hiring");
  return { error: null, built: clean.length };
}

export type TraitState = { error: string | null };

export async function addHiringTrait(_prev: TraitState, formData: FormData): Promise<TraitState> {
  const department = String(formData.get("department") || "");
  const title = String(formData.get("title") || "").trim();
  const question = String(formData.get("question") || "").trim();
  const greenFlag = String(formData.get("greenFlag") || "").trim();
  const redFlag = String(formData.get("redFlag") || "").trim();
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!title || !question) return { error: "Title and question are required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { count } = await supabase
    .from("hiring_traits")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);

  const { error } = await supabase.from("hiring_traits").insert({
    org_id: org.id,
    department,
    title,
    question,
    green_flag: greenFlag,
    red_flag: redFlag,
    sort_order: count ?? 0,
    source: "custom",
  });
  if (error) return { error: error.message };

  revalidatePath("/hiring");
  return { error: null };
}

export async function updateHiringTrait(
  id: string,
  patch: { title?: string; question?: string; green_flag?: string; red_flag?: string }
) {
  const allowed = new Set(["title", "question", "green_flag", "red_flag"]);
  const safe = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).filter(([k]) => allowed.has(k))
  );
  const supabase = await createClient();
  await supabase.from("hiring_traits").update(safe).eq("id", id);
  revalidatePath("/hiring");
}

export async function deleteHiringTrait(id: string) {
  const supabase = await createClient();
  await supabase.from("hiring_traits").delete().eq("id", id);
  revalidatePath("/hiring");
}

// ---------------------------------------------------------------------------
// Refine with AI: the owner describes changes in plain English and Wingman
// proposes add/edit/remove changes to the CURRENT hiring criteria. Nothing is
// written until the owner accepts (see applyHiringRefinement).
// ---------------------------------------------------------------------------
function extractJsonObject(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

type TraitFields = { title: string; question: string; green_flag: string; red_flag: string };
export type HiringChange = TraitFields & { id?: string; reason: string; before?: TraitFields };
export type HiringProposal = { summary: string; add: HiringChange[]; edit: HiringChange[]; remove: HiringChange[] };
export type RefineState = { error: string | null; proposal?: HiringProposal };

const REFINE_SHAPE = `{"summary": string, "add": [{"title": string, "question": string, "green_flag": string, "red_flag": string, "reason": string}], "edit": [{"id": string, "title": string, "question": string, "green_flag": string, "red_flag": string, "reason": string}], "remove": [{"id": string, "reason": string}]}`;

export async function refineHiring(_prev: RefineState, formData: FormData): Promise<RefineState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) {
    return { error: "You don't have access to edit hiring criteria." };
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

  const { data: rows } = await supabase
    .from("hiring_traits")
    .select("id, title, question, green_flag, red_flag")
    .eq("org_id", org.id)
    .eq("department", department)
    .order("sort_order");
  const byId = new Map<string, TraitFields>();
  for (const r of (rows ?? []) as (TraitFields & { id: string })[]) {
    byId.set(r.id, { title: r.title, question: r.question, green_flag: r.green_flag, red_flag: r.red_flag });
  }
  const currentForModel = [...byId.entries()].map(([id, v]) => ({ id, ...v }));

  const prompt = `You are refining the existing ${department} hiring criteria for a restaurant based on the owner's request.

CURRENT INTERVIEW TRAITS (JSON — each has a title, an interview question, a green_flag = what a good answer sounds like, and a red_flag = what a concerning answer sounds like):
${JSON.stringify(currentForModel)}

THE OWNER'S REQUEST:
"${feedback}"

Respond helpfully to what they asked. You can do any combination of:
- "add": propose brand-new traits (each with title, question, green_flag, red_flag). Be generous — if they ask to add something, ask for suggestions/ideas, or ask an open question ("what am I missing?"), propose 2-4 strong new traits. Don't hold back.
- "edit": improve an existing trait by its "id" (return the full improved title/question/green_flag/red_flag).
- "remove": remove an existing trait by its "id".

Only "edit" or "remove" traits whose "id" appears in the current list above. Keep every green_flag/red_flag concrete — never vague adjectives. Always propose at least one change unless the criteria already fully cover the request. Give a one-line "reason" for each change and a one-sentence "summary" of the whole proposal.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
${REFINE_SHAPE}`;

  let parsed: {
    summary?: string;
    add?: Partial<TraitFields & { reason: string }>[];
    edit?: Partial<TraitFields & { id: string; reason: string }>[];
    remove?: { id?: string; reason?: string }[];
  };
  try {
    const response = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 3500,
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

  const clip = (s: unknown, n = 400) => String(s ?? "").trim().slice(0, n);
  const fields = (o: Partial<TraitFields>): TraitFields => ({
    title: clip(o.title, 120),
    question: clip(o.question),
    green_flag: clip(o.green_flag),
    red_flag: clip(o.red_flag),
  });
  const add: HiringChange[] = (parsed.add ?? [])
    .filter((a) => String(a.title ?? "").trim() && String(a.question ?? "").trim())
    .map((a) => ({ ...fields(a), reason: clip(a.reason) }));
  const edit: HiringChange[] = (parsed.edit ?? [])
    .filter((e) => e.id && byId.has(String(e.id)) && String(e.title ?? "").trim())
    .map((e) => ({ id: String(e.id), ...fields(e), before: byId.get(String(e.id)), reason: clip(e.reason) }));
  const remove: HiringChange[] = (parsed.remove ?? [])
    .filter((r) => r.id && byId.has(String(r.id)))
    .map((r) => ({ id: String(r.id), ...byId.get(String(r.id))!, reason: clip(r.reason) }));

  if (add.length === 0 && edit.length === 0 && remove.length === 0) {
    return { error: "Wingman didn't find anything to change for that request. Try rephrasing what you'd like." };
  }

  return { error: null, proposal: { summary: clip(parsed.summary || "Proposed changes"), add, edit, remove } };
}

// Apply an owner-approved proposal. Re-validates every id against the DB, so a
// tampered payload can still only add/edit/remove this department's own traits.
export async function applyHiringRefinement(department: string, proposal: HiringProposal): Promise<TraitState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) {
    return { error: "You don't have access to edit hiring criteria." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { data: rows } = await supabase
    .from("hiring_traits")
    .select("id")
    .eq("org_id", org.id)
    .eq("department", department);
  const validIds = new Set((rows ?? []).map((r) => (r as { id: string }).id));

  const clip = (s: unknown, n = 400) => String(s ?? "").trim().slice(0, n);

  for (const r of proposal.remove ?? []) {
    if (!r.id || !validIds.has(String(r.id))) continue;
    await supabase.from("hiring_traits").delete().eq("id", r.id).eq("org_id", org.id);
  }
  for (const e of proposal.edit ?? []) {
    if (!e.id || !validIds.has(String(e.id)) || !clip(e.title, 120)) continue;
    await supabase
      .from("hiring_traits")
      .update({
        title: clip(e.title, 120),
        question: clip(e.question),
        green_flag: clip(e.green_flag),
        red_flag: clip(e.red_flag),
      })
      .eq("id", e.id)
      .eq("org_id", org.id);
  }
  const adds = (proposal.add ?? []).filter((a) => clip(a.title, 120) && clip(a.question));
  if (adds.length > 0) {
    const { count } = await supabase
      .from("hiring_traits")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("department", department);
    let sort = count ?? 0;
    const rowsToInsert = adds.map((a) => ({
      org_id: org.id,
      department,
      title: clip(a.title, 120),
      question: clip(a.question),
      green_flag: clip(a.green_flag),
      red_flag: clip(a.red_flag),
      sort_order: sort++,
      source: "custom",
    }));
    const { error } = await supabase.from("hiring_traits").insert(rowsToInsert);
    if (error) return { error: error.message };
  }

  revalidatePath("/hiring");
  return { error: null };
}
