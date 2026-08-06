"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { RATING_LABEL } from "@/lib/guest-survey";

export type ReviewSummaryState = { error: string | null; summary?: string };

const SYSTEM = `You are an elite restaurant operations advisor. You read raw guest survey feedback for ONE restaurant and write a short, honest readout the operator can act on today.

${HOSPITALITY_DOCTRINE}

Output THREE sections with these exact markdown bold headers and nothing else before or after:
**What guests love** — 2–4 concise bullets naming the themes guests praised.
**Where to improve** — 2–4 specific, actionable bullets drawn ONLY from the feedback.
**This week** — one sentence: the single highest-leverage fix to make now.
Keep it tight and concrete. Never invent feedback that isn't in the data.`;

export async function generateReviewSummary(scopeLocationId: string | null): Promise<ReviewSummaryState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can generate this." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const admin = createAdminClient();
  let q = admin
    .from("guest_survey_responses")
    .select("ratings, comment, created_at")
    .eq("org_id", profile.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(150);
  if (scopeLocationId) q = q.eq("location_id", scopeLocationId);
  const { data } = await q;
  const rows = (data ?? []) as { ratings: Record<string, number> | null; comment: string | null }[];
  if (rows.length === 0) return { error: "No guest feedback yet to summarize." };

  const { data: org } = await admin.from("organizations").select("owner_mindset").eq("id", profile.orgId).maybeSingle();
  const mindset = (org as { owner_mindset?: string | null } | null)?.owner_mindset ?? "";

  const lines = rows
    .map((r) => {
      const rt = Object.entries(r.ratings ?? {})
        .map(([k, v]) => `${(RATING_LABEL[k] ?? k).replace(/\?$/, "")}: ${v}/5`)
        .join(", ");
      const c = (r.comment ?? "").trim();
      return `- [${rt || "no ratings"}]${c ? ` "${c}"` : ""}`;
    })
    .join("\n");

  const prompt = `Guest survey feedback for ${profile.orgName} (${rows.length} response${rows.length === 1 ? "" : "s"}).${
    mindset ? `\n\nThe owner's mindset (reflect its spirit): ${mindset}` : ""
  }\n\nResponses:\n${lines}\n\nWrite the three-section readout.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 700, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const dataJson = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "review_summary", model: "claude-sonnet-5", usage: dataJson.usage });
    const text = (dataJson.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("The summary came back empty. Try again.");
    return { error: null, summary: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate the summary. Try again." };
  }
}
