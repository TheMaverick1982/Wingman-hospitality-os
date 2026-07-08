"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";

export type BuildState = { error: string | null; built?: number };

type GeneratedTrait = { title: string; question: string; green_flag: string; red_flag: string };

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

const SYSTEM_PROMPT =
  "You are an expert restaurant hiring consultant. Your entire job is to help operators screen for the person, not the resume: characteristics like hospitality instinct, coachability, resilience under pressure, and a genuine guest-first mindset predict success far more than years of experience. Every trait you write must be checkable through a real interview question with a concrete green flag (what a good answer sounds like) and red flag (what a bad answer sounds like) -- never vague adjectives. You output only valid JSON matching the requested schema exactly, no markdown fences, no commentary outside the JSON.";

const RESPONSE_SHAPE = `[{"title": string, "question": string, "green_flag": string, "red_flag": string}]`;

export async function generateHiringCriteria(_prev: BuildState, formData: FormData): Promise<BuildState> {
  const department = String(formData.get("department") || "");
  const mode = String(formData.get("mode") || "");
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (mode !== "upload" && mode !== "wizard") return { error: "Invalid mode." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY isn't configured yet -- add it in Vercel's project environment variables." };
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
      traits = JSON.parse(extractJsonArray(text));
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
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
      }
      const data = await response.json();
      const text = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");
      traits = JSON.parse(extractJsonArray(text));
    }

    if (!Array.isArray(traits) || traits.length === 0) {
      throw new Error("The generator returned an incomplete response. Try again.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Hiring criteria generation failed. Try again." };
  }

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
    traits.map((t, i) => ({
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
  return { error: null, built: traits.length };
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
  const supabase = await createClient();
  await supabase.from("hiring_traits").update(patch).eq("id", id);
  revalidatePath("/hiring");
}

export async function deleteHiringTrait(id: string) {
  const supabase = await createClient();
  await supabase.from("hiring_traits").delete().eq("id", id);
  revalidatePath("/hiring");
}
