import "server-only";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";
import {
  PRODUCT_ONE_LINER,
  WHY_IT_MATTERS,
  PRODUCT_TOUR,
  GOLDEN_RULES,
  RAPPORT,
  VOSS_TACTICS,
  PREP,
  MOVEMENTS,
  PIPELINE_PROCESS,
  QUESTION_BANK,
  REFRAMES,
  NEVER_DO,
  CLOSE_CHECKLIST,
  SYSTEM_REFERENCE,
  FRANCHISE_PLAYBOOK,
} from "@/lib/sales-playbook";

export const CERT_PASS_PCT = 80;
const GEN_MODEL = "claude-opus-4-8";
const GRADE_MODEL = "claude-sonnet-5";
// Platform-staff feature — usage is recorded against this pseudo-org bucket.
const CERT_ORG = "platform";

// The sections a rep is scored on. Kept aligned with the playbook shape.
export const CERT_SECTIONS = ["Product knowledge", "Discovery & questions", "Objection handling", "Franchise plan", "Closing & process"] as const;

// Serialize the current playbook into one corpus. The hash of this drives
// auto-refresh: change the training content → new hash → new test version.
export function playbookCorpus(): string {
  const parts: [string, unknown][] = [
    ["One-liner", PRODUCT_ONE_LINER],
    ["Why it matters", WHY_IT_MATTERS],
    ["Product tour", PRODUCT_TOUR],
    ["Golden rules", GOLDEN_RULES],
    ["Rapport", RAPPORT],
    ["Voss tactics", VOSS_TACTICS],
    ["Prep", PREP],
    ["Movements", MOVEMENTS],
    ["Pipeline process", PIPELINE_PROCESS],
    ["Question bank", QUESTION_BANK],
    ["Reframes", REFRAMES],
    ["Never do", NEVER_DO],
    ["Close checklist", CLOSE_CHECKLIST],
    ["System reference", SYSTEM_REFERENCE],
    ["Franchise plan", FRANCHISE_PLAYBOOK],
  ];
  return parts.map(([label, v]) => `## ${label}\n${JSON.stringify(v)}`).join("\n\n");
}

export function corpusHash(): string {
  return createHash("sha256").update(playbookCorpus()).digest("hex").slice(0, 32);
}

export type GenQuestion =
  | { kind: "mcq"; section: string; prompt: string; options: string[]; correct_index: number; explanation: string }
  | { kind: "roleplay"; section: string; prompt: string };

async function callClaude(system: string, prompt: string, model: string, maxTokens: number, feature: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("The AI isn't configured yet (missing ANTHROPIC_API_KEY).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const data = await res.json();
  await recordAiUsage({ orgId: CERT_ORG, feature, model, usage: data.usage }).catch(() => {});
  return ((data.content ?? []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}

function extractJson(raw: string): string {
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  return first !== -1 && last > first ? cleaned.slice(first, last + 1) : cleaned;
}

// Generate the quiz + roleplay from the current playbook.
async function generateQuestions(): Promise<GenQuestion[]> {
  const system = `You write a certification test for NEW SALES REPS selling "Wingman", a hospitality guest-retention SaaS. You are given the internal sales playbook. Write questions that verify a rep has actually learned it and can apply it on a live call.
Return ONLY JSON of the form:
{"mcq":[{"section":"<one of the sections>","prompt":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"why this is right"}],
 "roleplay":[{"section":"<one of the sections>","prompt":"A realistic prospect line or situation the rep must respond to out loud"}]}
Rules:
- section MUST be exactly one of: ${CERT_SECTIONS.join(" | ")}.
- Write 12 mcq (spread across all sections) and 3 roleplay (objection handling / discovery / closing).
- MCQs: 4 options each, exactly one correct, plausible distractors, grounded ONLY in the playbook.
- Roleplay prompts: short, realistic, force the rep to demonstrate a specific skill from the playbook.
- No markdown, no commentary — JSON only.`;
  const prompt = `Here is the current sales playbook. Write the test from it.\n\n${playbookCorpus()}`;
  const raw = await callClaude(system, prompt, GEN_MODEL, 8000, "sales_cert_generate");
  const parsed = JSON.parse(extractJson(raw)) as { mcq?: unknown[]; roleplay?: unknown[] };
  const out: GenQuestion[] = [];
  for (const m of (parsed.mcq ?? []) as Record<string, unknown>[]) {
    const options = Array.isArray(m.options) ? (m.options as string[]).map(String) : [];
    if (!m.prompt || options.length < 2) continue;
    out.push({
      kind: "mcq",
      section: normalizeSection(String(m.section ?? "")),
      prompt: String(m.prompt),
      options,
      correct_index: Math.max(0, Math.min(options.length - 1, Number(m.correct_index ?? 0))),
      explanation: String(m.explanation ?? ""),
    });
  }
  for (const r of (parsed.roleplay ?? []) as Record<string, unknown>[]) {
    if (!r.prompt) continue;
    out.push({ kind: "roleplay", section: normalizeSection(String(r.section ?? "")), prompt: String(r.prompt) });
  }
  if (out.length === 0) throw new Error("The AI returned no usable questions.");
  return out;
}

function normalizeSection(s: string): string {
  const hit = CERT_SECTIONS.find((sec) => sec.toLowerCase() === s.trim().toLowerCase());
  return hit ?? CERT_SECTIONS[0];
}

export type CertVersion = { id: string; contentHash: string; questionCount: number };

// Get the active test version for the current playbook, generating + persisting a
// new one if the content has changed since the last generation. Serialized-ish:
// a duplicate hash just returns the existing row.
export async function getActiveCertVersion(): Promise<CertVersion | null> {
  const admin = createAdminClient();
  const hash = corpusHash();
  const { data: existing } = await admin.from("sales_cert_versions").select("id, content_hash, question_count").eq("content_hash", hash).maybeSingle();
  if (existing) {
    const e = existing as { id: string; content_hash: string; question_count: number };
    return { id: e.id, contentHash: e.content_hash, questionCount: e.question_count };
  }

  let questions: GenQuestion[];
  try {
    questions = await generateQuestions();
  } catch {
    return null;
  }

  const { data: ver, error } = await admin.from("sales_cert_versions").insert({ content_hash: hash, question_count: questions.length }).select("id").single();
  if (error || !ver) {
    // Another request may have created it — return whatever's there now.
    const { data: race } = await admin.from("sales_cert_versions").select("id, content_hash, question_count").eq("content_hash", hash).maybeSingle();
    if (!race) return null;
    const r = race as { id: string; content_hash: string; question_count: number };
    return { id: r.id, contentHash: r.content_hash, questionCount: r.question_count };
  }
  const versionId = (ver as { id: string }).id;
  const rows = questions.map((q, i) => ({
    version_id: versionId,
    section: q.section,
    kind: q.kind,
    prompt: q.prompt,
    options: q.kind === "mcq" ? q.options : [],
    correct_index: q.kind === "mcq" ? q.correct_index : null,
    explanation: q.kind === "mcq" ? q.explanation : "",
    sort_order: i,
  }));
  await admin.from("sales_cert_questions").insert(rows);
  return { id: versionId, contentHash: hash, questionCount: questions.length };
}

// AI-grade a single roleplay answer. Returns 0-100 + short coaching feedback.
export async function gradeRoleplay(scenario: string, answer: string): Promise<{ score: number; feedback: string }> {
  if (!answer.trim()) return { score: 0, feedback: "No answer given." };
  const system = `You are a sales coach grading a rep's response in a roleplay for "Wingman" (hospitality retention SaaS). Grade how well the response handles the situation using good discovery/objection/closing technique (calm, curious, value-led, not pushy).
Return ONLY JSON: {"score": <0-100 integer>, "feedback": "one or two sentences of specific, actionable coaching"}.`;
  const prompt = `Situation (prospect): ${scenario}\n\nRep's response: ${answer}\n\nGrade it.`;
  try {
    const raw = await callClaude(system, prompt, GRADE_MODEL, 500, "sales_cert_grade");
    const parsed = JSON.parse(extractJson(raw)) as { score?: number; feedback?: string };
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
    return { score, feedback: String(parsed.feedback ?? "").slice(0, 600) };
  } catch {
    return { score: 0, feedback: "Couldn't grade this answer automatically — review it manually." };
  }
}
