"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import {
  FIVE_GAPS,
  AUDIT_DOMAINS,
  healthScore,
  auditScore,
  constraintGapIndex,
  fallbackActionPlan,
} from "@/lib/audit";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";

export type ActionState = { error: string | null; ok?: boolean };

function readScores(formData: FormData, prefix: string, count: number): number[] {
  return Array.from({ length: count }, (_v, i) => {
    const n = Number(formData.get(`${prefix}_${i}`));
    return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0;
  });
}

async function generateActionPlan(
  gapScores: number[],
  domainScores: number[],
  concept: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackActionPlan(gapScores);

  const gapLines = FIVE_GAPS.map((g, i) => `- ${g.label}: ${gapScores[i]}/5 (${g.question})`).join("\n");
  const domainLines = AUDIT_DOMAINS.map((d, i) => `- ${d.label}: ${domainScores[i]}/5`).join("\n");
  const constraint = FIVE_GAPS[constraintGapIndex(gapScores)].label;

  const system = `You are an elite restaurant operations consultant. You fix the single most-open constraint gap first, because effort spent elsewhere leaks out through it, and you write concrete, restaurant-specific, immediately-usable actions -- never generic advice, never vague value statements.

${HOSPITALITY_DOCTRINE}`;

  const prompt = `A ${concept || "full-service restaurant"} just completed the Standout Audit + 5-Gap Diagnosis.

5-Gap Diagnosis (0-5 each; lower = more open a gap):
${gapLines}

Standout Audit domains (0-5 each):
${domainLines}

The most-open constraint gap is: ${constraint}.

Write a tight action plan in markdown:
1. One sentence naming the constraint gap and why to fix it first.
2. Exactly 3 numbered moves to close that gap -- each a concrete, observable action a manager could start this week (not a mindset).
3. A short "Quick wins" line pointing at the 1-2 lowest-scoring audit domains with one specific fix each.
Keep it under 180 words. No preamble, no headers beyond what's described.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return fallbackActionPlan(gapScores);
    const data = await response.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    return text || fallbackActionPlan(gapScores);
  } catch {
    return fallbackActionPlan(gapScores);
  }
}

export async function runAudit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "audit", profile.permissionOverrides) !== "full") {
    return { error: "You don't have access to run an audit." };
  }

  // Super Admins choose the location; everyone else is locked to their own.
  const requestedLocation = String(formData.get("locationId") || "") || null;
  const locationId = profile.accessRole === "super_admin" ? requestedLocation : profile.locationId;
  const occurredOn = String(formData.get("occurredOn") || "") || new Date().toISOString().slice(0, 10);
  const concept = String(formData.get("concept") || "").trim();

  const gapScores = readScores(formData, "gap", FIVE_GAPS.length);
  const domainScores = readScores(formData, "domain", AUDIT_DOMAINS.length);
  const health = healthScore(gapScores);
  const audit = auditScore(domainScores);
  const actionPlan = await generateActionPlan(gapScores, domainScores, concept);

  const supabase = await createClient();
  const { error } = await supabase.from("audits").insert({
    org_id: profile.orgId,
    location_id: locationId,
    occurred_on: occurredOn,
    gap_scores: gapScores,
    domain_scores: domainScores,
    health_score: health,
    audit_score: audit,
    action_plan: actionPlan,
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/audit");
  return { error: null, ok: true };
}

export async function deleteAudit(id: string) {
  const supabase = await createClient();
  await supabase.from("audits").delete().eq("id", id);
  revalidatePath("/audit");
}
