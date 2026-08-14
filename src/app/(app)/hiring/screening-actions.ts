"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import { isScreeningAxis, type ScreeningAxis } from "@/lib/screening";

export type GeneratedQuestion = { prompt: string; axis: ScreeningAxis };
export type ScreeningBuildState = { error: string | null; questions?: GeneratedQuestion[]; built?: number };
export type ScreeningQState = { error: string | null };

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

const SYSTEM = `You are an elite restaurant hiring architect. You design SHORT pre-interview screening questions a candidate answers in writing on a job-application form, so an operator can decide — before spending an interview slot — whether someone is worth meeting. You screen for the person, not the resume: hospitality instinct and a genuine guest-first mindset predict success more than experience.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly, no markdown fences, no commentary outside the JSON.`;

const SHAPE = `[{"prompt": string, "axis": "hospitality" | "follows_instructions"}]`;

function cleanQuestions(raw: unknown[]): GeneratedQuestion[] {
  return (raw ?? [])
    .map((q) => {
      const o = (q ?? {}) as { prompt?: unknown; axis?: unknown };
      return { prompt: String(o.prompt ?? "").trim().slice(0, 500), axis: isScreeningAxis(o.axis) ? o.axis : ("hospitality" as ScreeningAxis) };
    })
    .filter((q) => q.prompt);
}

// Generate role-specific screening questions grounded in the restaurant's own
// hiring criteria for that role. Returns a preview — nothing saved until save*().
export async function generateScreeningQuestions(department: string): Promise<ScreeningBuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) {
    return { error: "You don't have access to generate screening questions." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const { data: traits } = await supabase
    .from("hiring_traits")
    .select("title, question, green_flag, red_flag")
    .eq("department", department)
    .order("sort_order");
  const criteria = (traits ?? [])
    .map((t) => {
      const r = t as { title: string; question: string; green_flag: string; red_flag: string };
      return `- ${r.title}: green flag = ${r.green_flag}; red flag = ${r.red_flag}`;
    })
    .join("\n");

  const prompt = `Design 4 short pre-interview screening questions for a restaurant's ${department} candidate to answer IN WRITING on the application form. They must be answerable in a few sentences.

${criteria ? `Ground them in this restaurant's own ${department} hiring criteria:\n${criteria}\n` : `Infer what genuinely predicts success for a ${department} in a hospitality-first restaurant.\n`}
Rules:
- Exactly 3 questions with axis "hospitality": real, specific guest-experience scenarios for THIS role that reveal warmth, ownership, reading the guest, and a guest-first instinct (not trivia, not yes/no).
- Exactly 1 question with axis "follows_instructions": a normal question that EMBEDS an explicit, checkable instruction inside it — for example a length limit, or "begin your answer with the word 'Absolutely'", or "answer in exactly two sentences". The point is that whether they follow the instruction is itself the signal, so the instruction must be unmistakable in the wording.
- Keep every question concise and role-appropriate. No preamble.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape (4 objects):
${SHAPE}`;

  let questions: GeneratedQuestion[];
  try {
    const res = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "screening_questions", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
    const parsed = JSON.parse(extractJsonArray(text));
    questions = cleanQuestions(Array.isArray(parsed) ? parsed : []);
    if (questions.length === 0) throw new Error("The generator returned an incomplete response. Try again.");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
  return { error: null, questions };
}

// Persist reviewed questions, replacing this role's previous AI output (keeps any
// the owner added by hand, which are source='custom').
export async function saveScreeningQuestions(department: string, questions: GeneratedQuestion[]): Promise<ScreeningBuildState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return { error: "Not authorized." };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };

  const clean = cleanQuestions(questions ?? []);
  if (clean.length === 0) return { error: "Nothing to save — keep at least one question." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  await supabase.from("screening_questions").delete().eq("org_id", org.id).eq("department", department).eq("source", "wingman");
  const { count: base } = await supabase
    .from("screening_questions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);
  const { error } = await supabase.from("screening_questions").insert(
    clean.map((q, i) => ({ org_id: org.id, department, prompt: q.prompt, axis: q.axis, sort_order: (base ?? 0) + i, source: "wingman" }))
  );
  if (error) return { error: error.message };

  revalidatePath("/hiring");
  return { error: null, built: clean.length };
}

export async function addScreeningQuestion(_prev: ScreeningQState, formData: FormData): Promise<ScreeningQState> {
  const department = String(formData.get("department") || "");
  const promptText = String(formData.get("prompt") || "").trim();
  const axis = isScreeningAxis(formData.get("axis")) ? (formData.get("axis") as ScreeningAxis) : "hospitality";
  const required = formData.get("required") === "1";
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };
  if (!promptText) return { error: "The question is required." };

  const profile = await getCurrentProfile();
  if (!profile || !canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const { count } = await supabase
    .from("screening_questions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("department", department);
  const { error } = await supabase
    .from("screening_questions")
    .insert({ org_id: org.id, department, prompt: promptText.slice(0, 500), axis, sort_order: count ?? 0, source: "custom", required });
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function updateScreeningQuestion(id: string, patch: { prompt?: string; axis?: ScreeningAxis; required?: boolean }) {
  const profile = await getCurrentProfile();
  if (!profile || !canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return;
  const safe: Record<string, unknown> = {};
  if (typeof patch.prompt === "string") safe.prompt = patch.prompt.trim().slice(0, 500);
  if (isScreeningAxis(patch.axis)) safe.axis = patch.axis;
  if (typeof patch.required === "boolean") safe.required = patch.required;
  if (Object.keys(safe).length === 0) return;
  const supabase = await createClient();
  await supabase.from("screening_questions").update(safe).eq("id", id);
  revalidatePath("/hiring");
}

// Make every screening question for a role required (or optional) in one toggle.
export async function setAllScreeningRequired(department: string, required: boolean) {
  const profile = await getCurrentProfile();
  if (!profile || !canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return;
  if (!ALL_DEPARTMENTS.includes(department as Department)) return;
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;
  await supabase.from("screening_questions").update({ required }).eq("org_id", org.id).eq("department", department);
  revalidatePath("/hiring");
}

export async function deleteScreeningQuestion(id: string) {
  const profile = await getCurrentProfile();
  if (!profile || !canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return;
  const supabase = await createClient();
  await supabase.from("screening_questions").delete().eq("id", id);
  revalidatePath("/hiring");
}
