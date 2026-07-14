"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";

export type JourneyState = { error: string | null };

// nonce increments per successful capture so the form remounts + clears.
export type CaptureState = { error: string | null; ok: boolean; capturedName: string | null; nonce: number };

// Log a first-time guest straight from the journey's arrival stage. Writes a
// real guests row (source='journey', captured_by=staff) plus visit 1 today, so
// the door-side "flag a first-timer" standard actually feeds Bounce Back instead
// of relying on someone re-entering them later. Anyone who can add to Bounce Back
// may capture.
export async function captureFirstTimer(prev: CaptureState, formData: FormData): Promise<CaptureState> {
  const nonce = prev.nonce ?? 0;
  const fail = (error: string): CaptureState => ({ error, ok: false, capturedName: null, nonce });

  const profile = await getCurrentProfile();
  if (!profile) return fail("You're not signed in.");
  if (!canEditSection(profile.accessRole, "bounceback", profile.permissionOverrides)) {
    return fail("You don't have access to log guests.");
  }

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!name) return fail("Enter the guest's name.");

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return fail("Organization not found.");

  const { data: guest, error } = await supabase
    .from("guests")
    .insert({ org_id: org.id, name, phone, email, source: "journey", captured_by: profile.fullName })
    .select("id")
    .single();
  if (error) return fail(error.message);

  const today = new Date().toISOString().slice(0, 10);
  const { error: vErr } = await supabase.from("guest_visits").insert({
    guest_id: guest.id,
    org_id: org.id,
    visit_number: 1,
    visit_date: today,
    location_id: profile.locationId,
  });
  if (vErr) return fail(vErr.message);

  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
  return { error: null, ok: true, capturedName: name, nonce: nonce + 1 };
}

type GeneratedStage = {
  name: string;
  purpose: string;
  avoid: string;
  standard: string;
  script: string;
  inspect: string;
  timing?: string;
};

// Shared model call — returns the raw text or throws.
async function callJourneyModel(apiKey: string, system: string, prompt: string, maxTokens: number, orgId: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  await recordAiUsage({ orgId, feature: "journey", model: "claude-sonnet-5", usage: data.usage });
  return (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
}

function extractJson(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

const STAGE_SYSTEM = `You are an elite hospitality systems consultant who designs guest-experience journeys for restaurants. You write ORIGINAL standards and scripts in the operator's own voice — never copied from any published workbook or training program.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly. Never include markdown code fences or any text outside the JSON object.`;

const STAGE_FIELD_SPEC = `For each stage:
- name: the moment, 1-3 words (e.g. "Arrival", "The Greet", "The Ask").
- purpose: one sentence on why this moment matters.
- avoid: the common mistake that quietly kills this moment — concrete, one line.
- standard: the non-negotiable, observable behavior — specific, with a number or trigger where it fits.
- script: an ORIGINAL example of what a team member could say or do here, in this restaurant's voice. Write it yourself; do not copy any known training material.
- inspect: the single thing a manager watches for to know the standard was hit (a yes/no observable).
- timing: a timing standard if the moment has one (e.g. "acknowledge within 10 seconds"), else "".`;

const FIRST_TIMER_SPEC = `IMPORTANT — first-time guest: In the FIRST stage (the arrival / greet), the standard AND the script must include a natural, warm way for the team to find out whether this is the guest's first visit — for example, working "Is this your first time with us?" into the welcome. Catching first-timers at the door feeds this restaurant's Guest Bounce Back program (turning first-timers into regulars), so make identifying the first-time guest a non-negotiable part of stage one, and note in that stage's "inspect" that the manager confirms first-timers are being spotted and captured.`;

function clipStage(s: GeneratedStage) {
  return {
    name: String(s.name ?? "").slice(0, 60),
    purpose: String(s.purpose ?? "").slice(0, 300),
    avoid: String(s.avoid ?? "").slice(0, 300),
    standard: String(s.standard ?? "").slice(0, 400),
    script: String(s.script ?? "").slice(0, 600),
    inspect: String(s.inspect ?? "").slice(0, 300),
    timing: String(s.timing ?? "").slice(0, 120),
  };
}

export type GenerateState = { error: string | null; stages?: GeneratedStage[]; summary?: string };

// Propose a guest journey (a PREVIEW, not saved) from the service style and the
// operator's own description of their restaurant. They review the recommendation
// and approve it before it replaces anything. Super Admin / Manager only.
export async function proposeJourney(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) {
    return { error: "Only a Super Admin or Manager can build the journey." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("name, philosophy").single();

  const style = String(formData.get("style") || "Full-service casual dining");
  const own = String(formData.get("description") || "").trim().slice(0, 3000);

  const schema = `{"summary": string, "stages": [{"name": string, "purpose": string, "avoid": string, "standard": string, "script": string, "inspect": string, "timing": string}]}`;
  const prompt = `Restaurant: ${(org as { name?: string } | null)?.name ?? ""}
Service style: ${style}
Their culture statement (match this voice and values): ${(org as { philosophy?: string } | null)?.philosophy || "not specified — infer from the service style"}
${own ? `\nThe operator described their own restaurant and how they want the guest experience to flow. Build the journey around THIS, in their words and honoring their specifics:\n"${own}"\n` : ""}
Map this restaurant's guest experience as an ordered journey of distinct moments, from the guest's arrival through the goodbye and the ask for a review. Choose the stages that fit THIS restaurant (a bar or fast-casual spot has different moments than fine dining) — usually 8 to 12 stages. Add a one-sentence "summary" of the journey you built.

Respond with ONLY valid JSON, no markdown fences, matching exactly:
${schema}

${STAGE_FIELD_SPEC}

${FIRST_TIMER_SPEC}

Make every line concrete and immediately usable by a real operator. No generic filler.`;

  try {
    const text = await callJourneyModel(apiKey, STAGE_SYSTEM, prompt, 8000, profile.orgId);
    const cleaned = extractJson(text);
    let parsed: { summary?: string; stages?: GeneratedStage[] };
    try {
      parsed = JSON.parse(cleaned) as { summary?: string; stages?: GeneratedStage[] };
    } catch {
      const lastObj = cleaned.lastIndexOf("}");
      const arrStart = cleaned.indexOf("[");
      if (lastObj > arrStart && arrStart !== -1) {
        parsed = JSON.parse(cleaned.slice(0, lastObj + 1) + "]}") as { summary?: string; stages?: GeneratedStage[] };
      } else {
        throw new Error("The journey was cut short while generating. Please try again.");
      }
    }
    const stages = (parsed.stages ?? []).filter((s) => s && s.name).slice(0, 14).map(clipStage);
    if (stages.length === 0) throw new Error("The generator returned no stages. Try again.");
    return { error: null, stages, summary: String(parsed.summary ?? "").slice(0, 300) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
}

// Save an approved set of proposed stages, replacing the current journey.
export async function applyJourneyStages(stages: GeneratedStage[]): Promise<JourneyState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) {
    return { error: "Not authorized." };
  }
  if (!Array.isArray(stages) || stages.length === 0) return { error: "Nothing to save." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  await supabase.from("journey_stages").delete().eq("org_id", org.id);
  const rows = stages.slice(0, 14).map((s, i) => ({ org_id: org.id, sort_order: i, ...clipStage(s) }));
  const { error } = await supabase.from("journey_stages").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/journey");
  return { error: null };
}

export type JourneyChange = GeneratedStage & { id?: string; reason: string; before?: GeneratedStage };
export type JourneyProposal = { summary: string; add: JourneyChange[]; edit: JourneyChange[]; remove: JourneyChange[] };
export type JourneyRefineState = { error: string | null; proposal?: JourneyProposal };

const JOURNEY_REFINE_SHAPE = `{"summary": string, "add": [{"name": string, "purpose": string, "avoid": string, "standard": string, "script": string, "inspect": string, "timing": string, "reason": string, "after_id": string}], "edit": [{"id": string, "name": string, "purpose": string, "avoid": string, "standard": string, "script": string, "inspect": string, "timing": string, "reason": string}], "remove": [{"id": string, "reason": string}]}`;

// Whole-journey change request: the operator asks in plain English ("add a wine
// pairing moment", "make the whole thing more upscale", "what am I missing?") and
// the AI proposes a set of stage add/edit/remove changes with reasons — a PREVIEW
// they approve before anything is applied. Super Admin / Manager only.
export async function refineJourney(_prev: JourneyRefineState, formData: FormData): Promise<JourneyRefineState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) {
    return { error: "Not authorized." };
  }
  const feedback = String(formData.get("feedback") || "").trim();
  if (!feedback) return { error: "Tell Wingman what you'd like to change or add." };
  if (feedback.length > 2000) return { error: "Please keep your request under 2000 characters." };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI. Please try again a bit later." };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const [{ data: org }, { data: stageRows }] = await Promise.all([
    supabase.from("organizations").select("name, philosophy").single(),
    supabase.from("journey_stages").select("id, name, purpose, avoid, standard, script, inspect, timing").order("sort_order"),
  ]);
  const byId = new Map<string, GeneratedStage>();
  for (const r of (stageRows ?? []) as (GeneratedStage & { id: string })[]) {
    byId.set(r.id, { name: r.name, purpose: r.purpose, avoid: r.avoid, standard: r.standard, script: r.script, inspect: r.inspect, timing: r.timing });
  }
  const currentForModel = [...byId.entries()].map(([id, v]) => ({ id, ...v }));

  const prompt = `Restaurant: ${(org as { name?: string } | null)?.name ?? ""}
Culture / voice (match this): ${(org as { philosophy?: string } | null)?.philosophy || "infer from the content"}

You are refining this restaurant's existing guest journey based on the operator's request.

CURRENT JOURNEY STAGES (JSON, in order):
${JSON.stringify(currentForModel)}

THE OPERATOR'S REQUEST:
"${feedback}"

Respond helpfully to what they asked. You can do any combination of:
- "add": propose brand-new stages (each with the full stage fields + a "reason", and "after_id" = the id of the stage it should follow, or "" to append at the end). If they ask to add something, ask for ideas, or ask an open question ("what am I missing?"), propose 1-3 strong new stages. Don't hold back.
- "edit": improve an existing stage by its "id" (return the full improved stage fields).
- "remove": remove an existing stage by its "id".

Only "edit" or "remove" stages whose "id" appears in the current list above. Write any script ORIGINALLY in the restaurant's voice (never copied from published material). Keep every line concrete and observable. Give a one-line "reason" for each change and a one-sentence "summary" of the whole proposal.

${STAGE_FIELD_SPEC}

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly:
${JOURNEY_REFINE_SHAPE}`;

  let parsed: {
    summary?: string;
    add?: (Partial<GeneratedStage> & { reason?: string; after_id?: string })[];
    edit?: (Partial<GeneratedStage> & { id?: string; reason?: string })[];
    remove?: { id?: string; reason?: string }[];
  };
  try {
    const text = await callJourneyModel(apiKey, STAGE_SYSTEM, prompt, 4000, profile.orgId);
    const cleaned = extractJson(text);
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { error: "Wingman couldn't turn that into changes — try a shorter, more specific request." };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate suggestions. Try again." };
  }

  const clip = (s: unknown, n = 300) => String(s ?? "").trim().slice(0, n);
  const add: JourneyChange[] = (parsed.add ?? [])
    .filter((a) => String(a.name ?? "").trim())
    .map((a) => ({ ...clipStage(a as GeneratedStage), reason: clip(a.reason), id: a.after_id ? String(a.after_id) : undefined }));
  const edit: JourneyChange[] = (parsed.edit ?? [])
    .filter((e) => e.id && byId.has(String(e.id)) && String(e.name ?? "").trim())
    .map((e) => ({ id: String(e.id), ...clipStage(e as GeneratedStage), before: byId.get(String(e.id)), reason: clip(e.reason) }));
  const remove: JourneyChange[] = (parsed.remove ?? [])
    .filter((r) => r.id && byId.has(String(r.id)))
    .map((r) => ({ id: String(r.id), ...byId.get(String(r.id))!, reason: clip(r.reason) }));

  if (add.length === 0 && edit.length === 0 && remove.length === 0) {
    return { error: "Wingman didn't find anything to change for that request. Try rephrasing what you'd like." };
  }

  return { error: null, proposal: { summary: clip(parsed.summary || "Proposed changes"), add, edit, remove } };
}

// Apply an owner-approved journey proposal. Re-validates every id against the DB,
// so a tampered payload can still only touch this org's own stages.
export async function applyJourneyRefinement(proposal: JourneyProposal): Promise<JourneyState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) {
    return { error: "Not authorized." };
  }
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { data: rows } = await supabase.from("journey_stages").select("id, sort_order").eq("org_id", org.id);
  const validIds = new Set((rows ?? []).map((r) => (r as { id: string }).id));
  let nextOrder = ((rows ?? []) as { sort_order: number }[]).reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;

  for (const r of proposal.remove ?? []) {
    if (r.id && validIds.has(String(r.id))) await supabase.from("journey_stages").delete().eq("id", r.id).eq("org_id", org.id);
  }
  for (const e of proposal.edit ?? []) {
    if (!e.id || !validIds.has(String(e.id)) || !String(e.name ?? "").trim()) continue;
    await supabase.from("journey_stages").update({ ...clipStage(e), updated_at: new Date().toISOString() }).eq("id", e.id).eq("org_id", org.id);
  }
  const adds = (proposal.add ?? []).filter((a) => String(a.name ?? "").trim());
  if (adds.length > 0) {
    await supabase.from("journey_stages").insert(adds.map((a) => ({ org_id: org.id, sort_order: nextOrder++, ...clipStage(a) })));
  }

  revalidatePath("/journey");
  return { error: null };
}

async function canEdit() {
  const p = await getCurrentProfile();
  return p && (p.accessRole === "super_admin" || p.accessRole === "manager");
}

// Log whether a stage's "manager inspects" standard was met on a spot-check.
// This is the write that makes the journey's inspect field a live metric.
// Managers/owners only.
export async function logInspection(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) return;
  const stageId = String(formData.get("stageId") || "");
  const passed = String(formData.get("passed") || "") === "true";
  if (!stageId) return;

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;
  await supabase.from("journey_inspections").insert({
    org_id: org.id,
    stage_id: stageId,
    location_id: profile.locationId,
    passed,
    checked_by: profile.fullName,
  });
  revalidatePath("/journey");
}

export type RefineState = { error: string | null; ok: boolean };

// Refine a single stage with plain-English feedback ("make it warmer", "add an
// upsell", "shorten the script"). The AI rewrites that one stage, keeping the
// same fields, in the restaurant's voice. Managers/owners only.
export async function refineStage(_prev: RefineState, formData: FormData): Promise<RefineState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) {
    return { error: "Not authorized.", ok: false };
  }
  const id = String(formData.get("id") || "");
  const feedback = String(formData.get("feedback") || "").trim();
  if (!id) return { error: "Missing stage.", ok: false };
  if (!feedback) return { error: "Tell the AI what to change.", ok: false };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI. Please try again a bit later.", ok: false };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment.", ok: false };

  const supabase = await createClient();
  const [{ data: stage }, { data: org }] = await Promise.all([
    supabase.from("journey_stages").select("id, name, purpose, avoid, standard, script, inspect, timing").eq("id", id).maybeSingle(),
    supabase.from("organizations").select("name, philosophy").single(),
  ]);
  if (!stage) return { error: "Stage not found.", ok: false };
  const s = stage as GeneratedStage & { id: string };

  const current = JSON.stringify({ name: s.name, purpose: s.purpose, avoid: s.avoid, standard: s.standard, script: s.script, inspect: s.inspect, timing: s.timing });
  const prompt = `Restaurant: ${(org as { name: string } | null)?.name ?? ""}
Culture / voice: ${(org as { philosophy: string | null } | null)?.philosophy || "infer from the content"}

This is one stage of the guest journey, as JSON:
${current}

The operator's feedback / requested change:
"${feedback}"

Rewrite THIS stage applying the feedback. Keep every field, keep it concrete and observable, and write any script ORIGINALLY in the restaurant's voice (never copied from published material). Respond with ONLY valid JSON, no markdown fences, matching exactly:
{"name": string, "purpose": string, "avoid": string, "standard": string, "script": string, "inspect": string, "timing": string}`;

  let out: GeneratedStage;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system: `You refine one guest-journey stage for a restaurant based on the operator's feedback. You write ORIGINAL standards and scripts in the operator's voice, never copied from any published workbook. Output only valid JSON matching the requested schema — no markdown fences, no commentary.

${HOSPITALITY_DOCTRINE}`,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API returned ${response.status}`);
    const data = await response.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "journey", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);
    out = JSON.parse(cleaned) as GeneratedStage;
    if (!out.name) throw new Error("The AI returned an incomplete stage. Try again.");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Refine failed. Try again.", ok: false };
  }

  await supabase
    .from("journey_stages")
    .update({
      name: String(out.name).slice(0, 60),
      purpose: String(out.purpose ?? "").slice(0, 300),
      avoid: String(out.avoid ?? "").slice(0, 300),
      standard: String(out.standard ?? "").slice(0, 400),
      script: String(out.script ?? "").slice(0, 600),
      inspect: String(out.inspect ?? "").slice(0, 300),
      timing: String(out.timing ?? "").slice(0, 120),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/journey");
  return { error: null, ok: true };
}

export async function updateStage(formData: FormData): Promise<void> {
  if (!(await canEdit())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("journey_stages")
    .update({
      name: String(formData.get("name") || "").slice(0, 60),
      purpose: String(formData.get("purpose") || "").slice(0, 300),
      avoid: String(formData.get("avoid") || "").slice(0, 300),
      standard: String(formData.get("standard") || "").slice(0, 400),
      script: String(formData.get("script") || "").slice(0, 600),
      inspect: String(formData.get("inspect") || "").slice(0, 300),
      timing: String(formData.get("timing") || "").slice(0, 120),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/journey");
}

export async function addStage(): Promise<void> {
  if (!(await canEdit())) return;
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;
  const { data: last } = await supabase.from("journey_stages").select("sort_order").eq("org_id", org.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  await supabase.from("journey_stages").insert({ org_id: org.id, sort_order: nextOrder, name: "New stage" });
  revalidatePath("/journey");
}

export async function deleteStage(formData: FormData): Promise<void> {
  if (!(await canEdit())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("journey_stages").delete().eq("id", id);
  revalidatePath("/journey");
}
