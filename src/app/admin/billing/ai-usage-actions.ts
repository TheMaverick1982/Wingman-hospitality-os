"use server";

import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiUsageSummary, type AiUsageSummary } from "@/lib/admin/ai-usage";

export type AiUsageRangeResult = { ok: true; summary: AiUsageSummary } | { ok: false; error: string };

// Recompute the AI usage summary for a chosen date range. Presets are rolling
// windows; "custom" uses the two date inputs (inclusive).
export async function aiUsageForRange(preset: string, startDate?: string, endDate?: string): Promise<AiUsageRangeResult> {
  const me = await platformSectionActor("billing");
  if (!me) return { ok: false, error: "Not authorized." };

  const now = new Date();
  const nowIso = now.toISOString();
  let start: string | null = null;
  let end: string | null = null;

  if (preset === "last_month") {
    start = new Date(now.getTime() - 30 * 86400000).toISOString();
  } else if (preset === "last_year") {
    start = new Date(now.getTime() - 365 * 86400000).toISOString();
  } else if (preset === "custom") {
    if (startDate) start = new Date(`${startDate}T00:00:00`).toISOString();
    if (endDate) end = new Date(`${endDate}T23:59:59`).toISOString();
  }
  // preset "all" leaves both null → whole history.

  const summary = await getAiUsageSummary(createAdminClient(), nowIso, { start, end });
  return { ok: true, summary };
}
