"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeRateLimit, AI_GENERATION_LIMIT } from "@/lib/rate-limit";

export type BuildState = { error: string | null; built?: { hospitality: number; role: number } };

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

const SYSTEM_PROMPT = `You are an elite hospitality training designer who builds world-class, role-specific training programs for restaurants -- the kind a great operator would be proud to run. Guest experience is woven into every role, and every item is a concrete behavior a manager can watch for. For any guest-facing role, always include at least one suggestive-selling behavior and one guest-recovery behavior built on the guided-influence structure; for roles that shape the room (Host, Manager, Chef, Bartender), include the physical environment as part of the job. Order the hospitality behaviors along the guest's journey -- greeting and first impression, discovery and personalization, guiding and selling, the check, then a warm goodbye that sets up the next visit -- so the program reads as a journey a guest actually travels, not a random list.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly, with no markdown fences and no commentary outside the JSON object.`;

const RESPONSE_SHAPE = `{"hospitality_items": [string], "role_items": [string], "track_label": string}`;

export async function generateRoleTraining(_prev: BuildState, formData: FormData): Promise<BuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) {
    return { error: "You don't have access to generate training content." };
  }
  if (!(await consumeRateLimit(`ai:${profile.orgId}`, AI_GENERATION_LIMIT.max, AI_GENERATION_LIMIT.windowSeconds))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const department = String(formData.get("department") || "");
  const mode = String(formData.get("mode") || "");
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (mode !== "upload" && mode !== "wizard") return { error: "Invalid mode." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY isn't configured yet -- add it in Vercel's project environment variables." };
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
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
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
      generated = JSON.parse(extractJsonObject(text));
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
        max_tokens: 1500,
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
      generated = JSON.parse(extractJsonObject(text));
    }

    if (!Array.isArray(generated.hospitality_items) || !Array.isArray(generated.role_items)) {
      throw new Error("The generator returned an incomplete response. Try again.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Training generation failed. Try again." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  // Replace this department's previous AI/upload output, but leave anything
  // a manager typed in by hand (source = 'custom') untouched.
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

  if (generated.hospitality_items.length > 0) {
    const { error } = await supabase.from("department_standards").insert(
      generated.hospitality_items.map((item, i) => ({
        org_id: org.id,
        department,
        item,
        sort_order: (standardsBase ?? 0) + i,
        source: "wingman",
      }))
    );
    if (error) return { error: error.message };
  }
  if (generated.role_items.length > 0) {
    const { error } = await supabase.from("department_training_items").insert(
      generated.role_items.map((item, i) => ({
        org_id: org.id,
        department,
        item,
        sort_order: (trainingBase ?? 0) + i,
        source: "wingman",
      }))
    );
    if (error) return { error: error.message };
  }
  if (generated.track_label) {
    await supabase
      .from("department_meta")
      .update({ track_label: generated.track_label })
      .eq("org_id", org.id)
      .eq("department", department);
  }

  revalidatePath("/training");
  return { error: null, built: { hospitality: generated.hospitality_items.length, role: generated.role_items.length } };
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

export async function deleteChecklistItem(list: ListKey, id: string) {
  const supabase = await createClient();
  await supabase.from("staff_training_progress").delete().eq("item_type", LIST_ITEM_TYPE[list]).eq("item_id", id);
  await supabase.from(LIST_TABLE[list]).delete().eq("id", id);
  revalidatePath("/training");
}
