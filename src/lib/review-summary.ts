import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAiUsage } from "@/lib/ai/usage";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { RATING_LABEL } from "@/lib/guest-survey";

// The combined guest-feedback readout — survey responses AND Google reviews in
// one AI summary. Shared by the on-demand "Summarize with AI" button and the
// scheduled digest cron, so both produce the identical three-section read.

// Build the system prompt for the read. `includeActions` adds the one-line
// "This week" fix (owners can turn it off for a pure love/improve read);
// `includeQuotes` asks the model to back each theme with a short verbatim guest
// quote from the data.
function buildSystem(includeActions: boolean, includeQuotes: boolean): string {
  const sections = [
    "**What guests love** — 2–4 concise bullets naming the themes guests praised.",
    "**Where to improve** — 2–4 specific, actionable bullets drawn ONLY from the feedback.",
  ];
  if (includeActions) sections.push("**This week** — one sentence: the single highest-leverage fix to make now.");
  const quoteRule = includeQuotes
    ? ` Support each theme with a SHORT direct quote pulled verbatim from the feedback, in quotation marks (3–15 words, exactly as written — never paraphrased or invented). If a point has no matching quote in the data, leave it unquoted.`
    : "";
  return `You are an elite restaurant operations advisor. You read raw guest feedback for ONE restaurant — from two sources: the restaurant's own guest survey, and its public Google reviews — and write a short, honest, COMBINED readout the operator can act on today. Weigh both sources together; where a theme shows up in both, that's a strong signal worth calling out.

${HOSPITALITY_DOCTRINE}

Output ${includeActions ? "THREE" : "TWO"} section${includeActions ? "s" : "s"} with these exact markdown bold headers and nothing else before or after:
${sections.join("\n")}
Keep it tight and concrete. When a point comes mainly from one source, you may note it briefly (e.g. "(Google)" or "(survey)").${quoteRule} Never invent feedback or quotes that aren't in the data.`;
}

export type ComposeResult = { error: string | null; summary?: string; surveyCount?: number; googleCount?: number };

export async function composeReviewSummary(
  admin: SupabaseClient,
  opts: { orgId: string; orgName: string; scopeLocationId: string | null; includeActions?: boolean; includeQuotes?: boolean },
): Promise<ComposeResult> {
  const includeActions = opts.includeActions !== false; // default on
  const includeQuotes = opts.includeQuotes === true; // default off
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  let sq = admin
    .from("guest_survey_responses")
    .select("ratings, comment, created_at")
    .eq("org_id", opts.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(150);
  if (opts.scopeLocationId) sq = sq.eq("location_id", opts.scopeLocationId);
  const { data: sData } = await sq;
  const rows = (sData ?? []) as { ratings: Record<string, number> | null; comment: string | null }[];

  let gRows: { star_rating: number; comment: string | null }[] = [];
  try {
    let gq = admin
      .from("google_reviews")
      .select("star_rating, comment, review_created_at")
      .eq("org_id", opts.orgId)
      .order("review_created_at", { ascending: false })
      .limit(100);
    if (opts.scopeLocationId) gq = gq.eq("location_id", opts.scopeLocationId);
    const { data: gData } = await gq;
    gRows = ((gData ?? []) as { star_rating: number; comment: string | null }[]).filter((r) => (r.comment ?? "").trim());
  } catch {
    gRows = [];
  }

  if (rows.length === 0 && gRows.length === 0) return { error: "No guest feedback yet to summarize." };

  const { data: org } = await admin.from("organizations").select("owner_mindset").eq("id", opts.orgId).maybeSingle();
  const mindset = (org as { owner_mindset?: string | null } | null)?.owner_mindset ?? "";

  const surveyLines = rows
    .map((r) => {
      const rt = Object.entries(r.ratings ?? {})
        .map(([k, v]) => `${(RATING_LABEL[k] ?? k).replace(/\?$/, "")}: ${v}/5`)
        .join(", ");
      const c = (r.comment ?? "").trim();
      return `- [${rt || "no ratings"}]${c ? ` "${c}"` : ""}`;
    })
    .join("\n");
  const googleLines = gRows.map((r) => `- [${r.star_rating}/5] "${(r.comment ?? "").trim()}"`).join("\n");

  const blocks = [
    rows.length > 0 ? `SURVEY FEEDBACK (${rows.length} response${rows.length === 1 ? "" : "s"}):\n${surveyLines}` : "",
    gRows.length > 0 ? `GOOGLE REVIEWS (${gRows.length} with comments):\n${googleLines}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = `Combined guest feedback for ${opts.orgName}.${
    mindset ? `\n\nThe owner's mindset (reflect its spirit): ${mindset}` : ""
  }\n\n${blocks}\n\nWrite the ${includeActions ? "three" : "two"}-section combined readout across both sources.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: includeQuotes ? 1000 : 700, system: buildSystem(includeActions, includeQuotes), messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const dataJson = await res.json();
    await recordAiUsage({ orgId: opts.orgId, feature: "review_summary", model: "claude-sonnet-5", usage: dataJson.usage });
    const text = (dataJson.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("The summary came back empty. Try again.");
    return { error: null, summary: text, surveyCount: rows.length, googleCount: gRows.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate the summary. Try again." };
  }
}
