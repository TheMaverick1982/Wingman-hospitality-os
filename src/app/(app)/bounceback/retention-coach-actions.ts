"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { fallbackQuestions, dropLabel, type DropStage } from "@/lib/retention-coach";

export type QuestionsResult = { error: string | null; questions: string[] };
export type PlanResult = { error: string | null; plan: string | null };

const MODEL = "claude-sonnet-5";

function funnelLines(stages: { fromVisit: number; toVisit: number; retentionPct: number }[]): string {
  return stages
    .map((s) => `- Visit ${s.fromVisit} → ${s.toVisit}: ${s.retentionPct}% of guests continue`)
    .join("\n");
}

async function callModel(system: string, prompt: string, maxTokens: number, orgId: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await recordAiUsage({ orgId, feature: "retention_coach", model: MODEL, usage: data.usage });
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

export type LocationHint = { name: string; pct: number; groupAvgPct: number } | null;

// Step 1: generate 3 short diagnostic questions tailored to the drop-off stage.
export async function getRetentionQuestions(input: {
  worst: DropStage;
  stages: { fromVisit: number; toVisit: number; retentionPct: number }[];
  locationHint?: LocationHint;
}): Promise<QuestionsResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're not signed in.", questions: fallbackQuestions(input.worst) };
  if (getSectionAccess(profile.accessRole, "bounceback", profile.permissionOverrides) === "none") {
    return { error: "You don't have access to this.", questions: fallbackQuestions(input.worst) };
  }

  const fallback = fallbackQuestions(input.worst);
  if (!(await consumeAiLimit(profile))) return { error: null, questions: fallback };

  const system = `You are an elite restaurant retention coach. You diagnose why guests stop returning by asking sharp, specific questions about the operator's actual process -- never generic, never leading. You ground everything in real hospitality practice.

${HOSPITALITY_DOCTRINE}`;

  const locLine = input.locationHint
    ? `\nThe drop-off is not even across locations: at ${input.locationHint.name}, only ${input.locationHint.pct}% continue vs a ${input.locationHint.groupAvgPct}% average across their locations. One of the 3 questions should probe whether something specific to that location is driving it.\n`
    : "";

  const prompt = `A restaurant is losing the most guests ${dropLabel(input.worst)} — only ${input.worst.retentionPct}% of the guests who reach visit ${input.worst.fromVisit} go on to visit ${input.worst.toVisit}.

Their full visit funnel:
${funnelLines(input.stages)}
${locLine}
Write exactly 3 diagnostic questions to ask this operator about what happens at that drop-off point, so we can find the real cause. Each question should probe a different part of the process (the in-restaurant experience, the follow-up/offer, and recognition/relationship). Make them specific to guests dropping off ${dropLabel(input.worst)}.

Return ONLY the 3 questions, one per line, no numbering, no preamble.`;

  const text = await callModel(system, prompt, 400, profile.orgId);
  if (!text) return { error: null, questions: fallback };

  const questions = text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[.)]\s*|[-*]\s*)/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);

  return { error: null, questions: questions.length >= 2 ? questions : fallback };
}

// Step 2: turn the operator's answers into a concrete action plan for that stage.
export async function generateRetentionPlan(input: {
  worst: DropStage;
  stages: { fromVisit: number; toVisit: number; retentionPct: number }[];
  qa: { question: string; answer: string }[];
  locationHint?: LocationHint;
}): Promise<PlanResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're not signed in.", plan: null };
  if (!canEditSection(profile.accessRole, "bounceback", profile.permissionOverrides)) {
    return { error: "You don't have access to generate a plan.", plan: null };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later.", plan: null };
  }

  const answered = input.qa.filter((x) => x.answer.trim().length > 0);
  if (answered.length === 0) return { error: "Answer at least one question so the plan has something to work with.", plan: null };

  const system = `You are an elite restaurant retention coach. You turn a diagnosis into a concrete, immediately-usable action plan -- specific moves a manager can start this week, never generic advice, never vague mindset statements. You ground everything in real hospitality practice.

${HOSPITALITY_DOCTRINE}`;

  const qaBlock = answered.map((x) => `Q: ${x.question}\nA: ${x.answer.trim()}`).join("\n\n");

  const locLine = input.locationHint
    ? `\nNote: the drop-off is worst at ${input.locationHint.name} (${input.locationHint.pct}% continue vs a ${input.locationHint.groupAvgPct}% average across locations). Factor this in — at least one move should address checking or fixing that specific location.\n`
    : "";

  const prompt = `A restaurant is losing the most guests ${dropLabel(input.worst)} — only ${input.worst.retentionPct}% of guests who reach visit ${input.worst.fromVisit} continue to visit ${input.worst.toVisit}.

Their visit funnel:
${funnelLines(input.stages)}
${locLine}
Here's what the operator told me about their process at that stage:

${qaBlock}

Write a tight, specific action plan in markdown to fix this drop-off. Use their answers — call out what's missing or weak in what they described. Structure:
1. One sentence naming exactly where and why they're losing these guests (reference their answers${input.locationHint ? " and the weaker location" : ""}).
2. Exactly 3 numbered moves — each a concrete, observable action the team could start this week to pull more guests to the next visit. Tie at least one to a bounce-back offer or follow-up.
3. A short "This week" line with the single first step to take.
Keep it under 200 words. **Bold** the key phrases. No preamble, no headers beyond what's described.`;

  const text = await callModel(system, prompt, 800, profile.orgId);
  if (!text) {
    return {
      error: null,
      plan: `**Where you're losing them:** guests are dropping off ${dropLabel(input.worst)} — only ${input.worst.retentionPct}% continue to visit ${input.worst.toVisit}.\n\n1. **Recognize the return.** Make sure the team knows who's on their 2nd or 3rd visit and treats them like it — a "good to see you back" changes the whole visit.\n2. **Hand over a reason to return.** Give every guest at this stage a specific, time-boxed bounce-back offer before they leave — not "come again," an actual hook.\n3. **Follow up within 48 hours.** A short thank-you or invite while the visit is fresh pulls far more people back than hoping they remember.\n\n**This week:** pick the one move above you're not doing at all, and start it on your next shift.`,
    };
  }

  return { error: null, plan: text };
}
