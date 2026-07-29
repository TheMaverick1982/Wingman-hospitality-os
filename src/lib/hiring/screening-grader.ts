import "server-only";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { recordAiUsage } from "@/lib/ai/usage";
import type { ScreeningAnswer, ScreeningGrade } from "@/lib/screening";
import { tierFromScore } from "@/lib/screening";

// A cheap, fast model — this runs at application-submit volume on the public form.
const GRADER_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are an elite restaurant hiring screener. You read a job applicant's short written answers and grade them BEFORE any human interview, so a manager can decide whether an interview is worth their time. You are decision SUPPORT, not a decision maker: you never reject anyone, you give a fair read with concrete reasoning. You judge the person, not the resume — hospitality instinct, warmth, ownership, and a genuine guest-first mindset matter more than polish.

${HOSPITALITY_DOCTRINE}

You output only valid JSON matching the requested schema exactly — no markdown fences, no commentary outside the JSON.`;

function extractJsonObject(text: string): string {
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

const clampScore = (n: unknown): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, v));
};

// Grade a candidate's screening answers on two axes. Returns null on any failure
// (missing key, API error, unparseable output) — the caller treats grading as
// best-effort so it never blocks a real applicant's submission.
export async function gradeScreeningAnswers(opts: {
  orgId: string;
  department: string;
  answers: ScreeningAnswer[];
}): Promise<ScreeningGrade | null> {
  const { orgId, department, answers } = opts;
  const answered = answers.filter((a) => String(a.value ?? "").trim());
  if (answered.length === 0) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const qa = answered
    .map(
      (a, i) =>
        `Q${i + 1} [${a.axis === "follows_instructions" ? "follows-instructions probe" : "hospitality probe"}]: ${a.prompt}\nA${i + 1}: ${String(a.value).slice(0, 1500)}`
    )
    .join("\n\n");

  const schema = `{"hospitality": {"score": 1-5, "rationale": string}, "followsInstructions": {"score": 1-5, "rationale": string}, "overall": 1-5, "tier": "strong" | "worth_a_look" | "pass", "summary": string}`;
  const prompt = `A candidate applied for the ${department} role and answered these screening questions. Grade them on two axes, 1 (weak) to 5 (excellent):

1. "hospitality" — guest-experience instinct: warmth, ownership of a problem, reading the guest, a genuine desire to take care of people. Judge from what their answers reveal, not how polished the writing is.
2. "followsInstructions" — did they actually do what each question asked? Some questions embed an explicit instruction (e.g. a length limit, "begin with this word", answer a specific thing). Reward answers that follow the instruction precisely and address what was asked; penalize ones that ignore it, ramble past a limit, or dodge the question. This is a real signal of coachability.

Give each axis a one-sentence rationale a manager can act on. Set "overall" to the rounded average of the two scores. Set "tier": "strong" (clearly worth an interview), "worth_a_look" (mixed — a manager should decide), or "pass" (likely not worth an interview). Write a one-sentence "summary".

Be fair and specific. You are helping a human decide, never auto-rejecting.

ANSWERS:
"""
${qa.slice(0, 8000)}
"""

Respond with ONLY valid JSON, matching exactly:
${schema}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: GRADER_MODEL, max_tokens: 900, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await recordAiUsage({ orgId, feature: "applicant_screening", model: GRADER_MODEL, usage: data.usage }).catch(() => undefined);
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    const parsed = JSON.parse(extractJsonObject(text)) as {
      hospitality?: { score?: number; rationale?: string };
      followsInstructions?: { score?: number; rationale?: string };
      overall?: number;
      tier?: string;
      summary?: string;
    };
    const hospitality = { score: clampScore(parsed.hospitality?.score), rationale: String(parsed.hospitality?.rationale ?? "").slice(0, 400) };
    const followsInstructions = { score: clampScore(parsed.followsInstructions?.score), rationale: String(parsed.followsInstructions?.rationale ?? "").slice(0, 400) };
    const overall = Number.isFinite(Number(parsed.overall))
      ? Math.max(1, Math.min(5, Math.round((Number(parsed.overall) + Number.EPSILON) * 10) / 10))
      : Math.round(((hospitality.score + followsInstructions.score) / 2) * 10) / 10;
    const tier = parsed.tier === "strong" || parsed.tier === "worth_a_look" || parsed.tier === "pass" ? parsed.tier : tierFromScore(overall);
    return { hospitality, followsInstructions, overall, tier, summary: String(parsed.summary ?? "").slice(0, 300) };
  } catch {
    return null;
  }
}
