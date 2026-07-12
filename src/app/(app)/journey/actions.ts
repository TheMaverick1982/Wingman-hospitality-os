"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { consumeAiLimit } from "@/lib/rate-limit";

export type JourneyState = { error: string | null };

type GeneratedStage = {
  name: string;
  purpose: string;
  avoid: string;
  standard: string;
  script: string;
  inspect: string;
  timing?: string;
};

// AI-generate a guest journey tailored to this concept, then replace the org's
// stages. Super Admin / Manager only. Grounded in the hospitality doctrine.
export async function generateJourney(_prev: JourneyState, formData: FormData): Promise<JourneyState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.accessRole !== "super_admin" && profile.accessRole !== "manager")) {
    return { error: "Only a Super Admin or Manager can generate the journey." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY isn't configured yet — add it in Vercel." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, name, philosophy").single();
  if (!org) return { error: "Organization not found." };

  const style = String(formData.get("style") || "Full-service casual dining");

  const schema = `{"stages": [{"name": string, "purpose": string, "avoid": string, "standard": string, "script": string, "inspect": string, "timing": string}]}`;
  const prompt = `Restaurant: ${org.name}
Service style: ${style}
Their culture statement (match this voice and values): ${org.philosophy || "not specified — infer from the service style"}

Map this restaurant's guest experience as an ordered journey of distinct moments, from the guest's arrival through the goodbye and the ask for a review. Choose the stages that fit THIS service style (a bar or fast-casual spot has different moments than fine dining) — usually 8 to 12 stages.

Respond with ONLY valid JSON, no markdown fences, matching exactly:
${schema}

For each stage:
- name: the moment, 1-3 words (e.g. "Arrival", "The Greet", "The Ask").
- purpose: one sentence on why this moment matters.
- avoid: the common mistake that quietly kills this moment — concrete, one line.
- standard: the non-negotiable, observable behavior — specific, with a number or trigger where it fits.
- script: an ORIGINAL example of what a team member could say or do here, in this restaurant's voice. Write it yourself; do not copy any known training material.
- inspect: the single thing a manager watches for to know the standard was hit (a yes/no observable).
- timing: a timing standard if the moment has one (e.g. "acknowledge within 10 seconds"), else "".

Make every line concrete and immediately usable by a real operator. No generic filler.`;

  let stages: GeneratedStage[];
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: `You are an elite hospitality systems consultant who designs guest-experience journeys for restaurants. You write ORIGINAL standards and scripts in the operator's own voice — never copied from any published workbook or training program.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly. Never include markdown code fences or any text outside the JSON object.`,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

    let parsed: { stages?: GeneratedStage[] };
    try {
      parsed = JSON.parse(cleaned) as { stages?: GeneratedStage[] };
    } catch {
      // Salvage a truncated response: keep everything up to the last complete
      // stage object and close the array/root.
      const lastObj = cleaned.lastIndexOf("}");
      const arrStart = cleaned.indexOf("[");
      if (lastObj > arrStart && arrStart !== -1) {
        parsed = JSON.parse(cleaned.slice(0, lastObj + 1) + "]}") as { stages?: GeneratedStage[] };
      } else {
        throw new Error("The journey was cut short while generating. Please try again.");
      }
    }
    stages = (parsed.stages ?? []).filter((s) => s && s.name);
    if (stages.length === 0) throw new Error("The generator returned no stages. Try again.");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }

  await supabase.from("journey_stages").delete().eq("org_id", org.id);
  const rows = stages.slice(0, 14).map((s, i) => ({
    org_id: org.id,
    sort_order: i,
    name: String(s.name).slice(0, 60),
    purpose: String(s.purpose ?? "").slice(0, 300),
    avoid: String(s.avoid ?? "").slice(0, 300),
    standard: String(s.standard ?? "").slice(0, 400),
    script: String(s.script ?? "").slice(0, 600),
    inspect: String(s.inspect ?? "").slice(0, 300),
    timing: String(s.timing ?? "").slice(0, 120),
  }));
  const { error } = await supabase.from("journey_stages").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/journey");
  return { error: null };
}

async function canEdit() {
  const p = await getCurrentProfile();
  return p && (p.accessRole === "super_admin" || p.accessRole === "manager");
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
  if (!apiKey) return { error: "ANTHROPIC_API_KEY isn't configured yet.", ok: false };

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
