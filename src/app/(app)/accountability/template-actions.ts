"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DAILY_CHECKLIST_ITEMS, PRE_SHIFT_ITEMS } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeRateLimit, AI_GENERATION_LIMIT } from "@/lib/rate-limit";

export type ChecklistType = "daily" | "preshift";

export type TemplateItem = { id: string; item: string; source: "wingman" | "custom" };

const DEFAULTS: Record<ChecklistType, readonly string[]> = {
  daily: DAILY_CHECKLIST_ITEMS,
  preshift: PRE_SHIFT_ITEMS,
};

const CHECKLIST_LABEL: Record<ChecklistType, string> = {
  daily: "Manager daily checklist",
  preshift: "Pre-shift staff checklist",
};

/** Org's custom items if they've saved any, else the app's built-in defaults. */
export async function getChecklistItems(checklistType: ChecklistType): Promise<TemplateItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accountability_checklist_items")
    .select("id, item, source")
    .eq("checklist_type", checklistType)
    .order("sort_order");
  if (data && data.length > 0) return data;
  return DEFAULTS[checklistType].map((item, i) => ({ id: `default-${i}`, item, source: "wingman" as const }));
}

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
    throw new Error("Couldn't read a complete checklist from that file. Try a clearer or shorter PDF, or paste the text instead.");
  }
}

const SYSTEM_PROMPT = `You are an elite restaurant accountability-systems consultant. Every checklist you build makes guest experience inseparable from operational discipline: items should catch whether the team actually connected with guests and shaped the room, not only whether the mechanical steps were done. Every item must be specific and observable enough that someone could watch for it or self-check it in seconds -- never a vague value statement -- and environment-facing checks must name the concrete sensory and sanitation levers.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly, no markdown fences, no commentary outside the JSON.`;

export type BuildState = { error: string | null; built?: number };

export async function generateAccountabilityChecklist(_prev: BuildState, formData: FormData): Promise<BuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "accountability", profile.permissionOverrides)) {
    return { error: "You don't have access to generate checklists." };
  }
  if (!(await consumeRateLimit(`ai:${profile.orgId}`, AI_GENERATION_LIMIT.max, AI_GENERATION_LIMIT.windowSeconds))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const checklistType = String(formData.get("checklistType") || "") as ChecklistType;
  const mode = String(formData.get("mode") || "");
  if (!CHECKLIST_LABEL[checklistType]) return { error: "Invalid checklist." };
  if (mode !== "upload" && mode !== "paste" && mode !== "wizard") return { error: "Invalid mode." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY isn't configured yet -- add it in Vercel's project environment variables." };
  }

  const label = CHECKLIST_LABEL[checklistType];
  const who = checklistType === "daily" ? "a manager, once per shift" : "each staff member, before their shift starts";

  let items: string[];
  try {
    if (mode === "upload") {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Choose an existing checklist document (PDF or image) first." };
      if (file.size > 10 * 1024 * 1024) return { error: "File is too large -- 10MB max." };
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) return { error: "Upload a PDF or image (JPG/PNG) of the existing checklist." };

      const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes } }
        : { type: "image", source: { type: "base64", media_type: file.type, data: bytes } };

      const prompt = `This is an existing "${label}" document, completed by ${who} at a restaurant. Read everything in it.

Your job:
1. Extract every concrete, checkable item already used.
2. Then ADD any additional items you'd recommend from hospitality and guest-experience best practices that are missing, so the result is a complete, best-practice checklist, not just a transcription. Guest experience must show up alongside operational/cleanliness items, not be left out.
3. Keep every item under 14 words, phrased as a short, concrete, checkable action.

Respond with ONLY a valid JSON array of strings, no markdown fences, no commentary, e.g. ["item one", "item two"]`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      });
      items = (await parseGeneratedArray(response)) as string[];
    } else if (mode === "paste") {
      const pastedText = String(formData.get("pastedText") || "").trim();
      if (!pastedText) return { error: "Paste your existing checklist text first." };
      if (pastedText.length > 30000) return { error: "That's a lot of text — trim it to the essentials (30,000 characters max)." };

      const prompt = `Below is an existing "${label}" completed by ${who} at a restaurant. Read all of it.

Your job:
1. Extract every concrete, checkable item already used.
2. Then ADD any additional items you'd recommend from hospitality and guest-experience best practices that are missing, so the result is a complete, best-practice checklist, not just a transcription. Guest experience must show up alongside operational/cleanliness items.
3. Keep every item under 14 words, phrased as a short, concrete, checkable action.

CHECKLIST TEXT:
"""
${pastedText}
"""

Respond with ONLY a valid JSON array of strings, no markdown fences, no commentary, e.g. ["item one", "item two"]`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      items = (await parseGeneratedArray(response)) as string[];
    } else {
      const painPoint = String(formData.get("painPoint") || "").trim();
      const mustHave = String(formData.get("mustHave") || "").trim();

      const prompt = `Build a complete "${label}" from scratch -- completed by ${who} at a restaurant.

Current #1 recurring issue this checklist should catch: ${painPoint || "not specified"}
What "guest experience done right" looks like on the floor, that this checklist should reinforce: ${mustHave || "not specified, infer from a strong hospitality standard"}

Generate 5-7 items. Every item under 14 words, phrased as a short, concrete, checkable action. Guest-experience behaviors (recognition, reading the room, personal touches) must appear alongside operational/readiness items, not be left out.

Respond with ONLY a valid JSON array of strings, no markdown fences, no commentary, e.g. ["item one", "item two"]`;

      const response = await callAnthropic(apiKey, {
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      items = (await parseGeneratedArray(response)) as string[];
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("The generator returned an incomplete response. Try again.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Checklist generation failed. Try again." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  await supabase.from("accountability_checklist_items").delete().eq("org_id", org.id).eq("checklist_type", checklistType).eq("source", "wingman");

  const { count: base } = await supabase
    .from("accountability_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("checklist_type", checklistType);

  const { error } = await supabase.from("accountability_checklist_items").insert(
    items.map((item, i) => ({
      org_id: org.id,
      checklist_type: checklistType,
      item,
      sort_order: (base ?? 0) + i,
      source: "wingman",
    }))
  );
  if (error) return { error: error.message };

  revalidatePath("/accountability");
  return { error: null, built: items.length };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// First edit for this org/type "forks" from the built-in defaults, since the
// org has no rows yet and getChecklistItems() would otherwise fall back to
// them -- seed the defaults as real 'wingman' rows so they have real ids to
// edit/delete. Returns the seeded rows (id, sort_order) if it seeded, so a
// caller holding a synthetic "default-{index}" id can resolve it to a real one.
async function seedDefaultsIfEmpty(supabase: SupabaseClient, orgId: string, checklistType: ChecklistType) {
  const { count } = await supabase
    .from("accountability_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("checklist_type", checklistType);
  if (count) return null;

  const { data } = await supabase
    .from("accountability_checklist_items")
    .insert(
      DEFAULTS[checklistType].map((item, i) => ({ org_id: orgId, checklist_type: checklistType, item, sort_order: i, source: "wingman" as const }))
    )
    .select("id, sort_order");
  return data ?? [];
}

async function resolveId(supabase: SupabaseClient, orgId: string, checklistType: ChecklistType, id: string): Promise<string | null> {
  if (!id.startsWith("default-")) return id;
  const index = Number(id.slice("default-".length));
  const seeded = await seedDefaultsIfEmpty(supabase, orgId, checklistType);
  const rows =
    seeded ??
    (await supabase.from("accountability_checklist_items").select("id, sort_order").eq("org_id", orgId).eq("checklist_type", checklistType)).data ??
    [];
  return rows.find((r) => r.sort_order === index)?.id ?? null;
}

export type ItemState = { error: string | null };

export async function addAccountabilityItem(_prev: ItemState, formData: FormData): Promise<ItemState> {
  const checklistType = String(formData.get("checklistType") || "") as ChecklistType;
  const text = String(formData.get("text") || "").trim();
  if (!CHECKLIST_LABEL[checklistType]) return { error: "Invalid checklist." };
  if (!text) return { error: "Item text is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  await seedDefaultsIfEmpty(supabase, org.id, checklistType);

  const { count: newCount } = await supabase
    .from("accountability_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("checklist_type", checklistType);

  const { error } = await supabase.from("accountability_checklist_items").insert({
    org_id: org.id,
    checklist_type: checklistType,
    item: text,
    sort_order: newCount ?? 0,
    source: "custom",
  });
  if (error) return { error: error.message };

  revalidatePath("/accountability");
  return { error: null };
}

export async function updateAccountabilityItemText(checklistType: ChecklistType, id: string, text: string) {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;
  const realId = await resolveId(supabase, org.id, checklistType, id);
  if (!realId) return;
  await supabase.from("accountability_checklist_items").update({ item: text }).eq("id", realId);
  revalidatePath("/accountability");
}

export async function deleteAccountabilityItem(checklistType: ChecklistType, id: string) {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;
  const realId = await resolveId(supabase, org.id, checklistType, id);
  if (!realId) return;
  await supabase.from("accountability_checklist_items").delete().eq("id", realId);
  revalidatePath("/accountability");
}
