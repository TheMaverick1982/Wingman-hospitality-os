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

Output ALL ${includeActions ? "THREE" : "TWO"} section${includeActions ? "s" : "s"} below, in this order, with these EXACT markdown bold headers and nothing else before or after. ALWAYS include every header even when a section is light — if there's little to say, still write the header with one short honest line (e.g. under "Where to improve": "Nothing significant flagged this period.") rather than dropping the section:
${sections.join("\n")}
Keep it tight and concrete, and finish every section — do not cut off mid-sentence. When a point comes mainly from one source, you may note it briefly (e.g. "(Google)" or "(survey)").${quoteRule} Never invent feedback or quotes that aren't in the data.`;
}

export type ComposeResult = { error: string | null; summary?: string; surveyCount?: number; googleCount?: number };

export async function composeReviewSummary(
  admin: SupabaseClient,
  opts: {
    orgId: string;
    orgName: string;
    scopeLocationId: string | null;
    includeActions?: boolean;
    includeQuotes?: boolean;
    // Only summarize feedback on/after this ISO timestamp. Scheduled reports pass
    // their period (last day/week/month) so each report covers ONLY new feedback
    // and never re-reports the same old reviews. Omit for an all-time read (the
    // on-demand "Summarize with AI" button).
    sinceIso?: string | null;
    periodLabel?: string; // e.g. "the last week" — for the prompt when windowed
  },
): Promise<ComposeResult> {
  const includeActions = opts.includeActions !== false; // default on
  const includeQuotes = opts.includeQuotes === true; // default off
  const windowed = !!opts.sinceIso;
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
  if (opts.sinceIso) sq = sq.gte("created_at", opts.sinceIso);
  const { data: sData } = await sq;
  const rows = (sData ?? []) as { ratings: Record<string, number> | null; comment: string | null }[];

  // Pull ALL Google reviews (star-only ones are still signal), not just those with
  // a written comment — a location like a Google-only store often has ratings with
  // little text, and it should still get a report.
  let gAll: { star_rating: number; comment: string | null }[] = [];
  try {
    let gq = admin
      .from("google_reviews")
      .select("star_rating, comment, review_created_at")
      .eq("org_id", opts.orgId)
      .order("review_created_at", { ascending: false })
      .limit(100);
    if (opts.scopeLocationId) gq = gq.eq("location_id", opts.scopeLocationId);
    if (opts.sinceIso) gq = gq.gte("review_created_at", opts.sinceIso);
    const { data: gData } = await gq;
    gAll = (gData ?? []) as { star_rating: number; comment: string | null }[];
  } catch {
    gAll = [];
  }
  const gCommented = gAll.filter((r) => (r.comment ?? "").trim());

  // Cached Google rating + count from the location mapping, so even a store with a
  // Google presence but no synced individual reviews still has something to report.
  let gRating: number | null = null;
  let gCount = 0;
  try {
    let mq = admin.from("google_review_locations").select("average_rating, review_count").eq("org_id", opts.orgId);
    if (opts.scopeLocationId) mq = mq.eq("location_id", opts.scopeLocationId);
    const { data: mData } = await mq;
    const maps = (mData ?? []) as { average_rating: number | null; review_count: number | null }[];
    let weighted = 0;
    let denom = 0;
    for (const m of maps) {
      const c = m.review_count ?? 0;
      gCount += c;
      if (m.average_rating != null && c > 0) { weighted += m.average_rating * c; denom += c; }
    }
    if (denom > 0) gRating = Math.round((weighted / denom) * 10) / 10;
  } catch {
    /* rating context is best-effort */
  }

  // What counts as "there's something to report." A windowed (scheduled) report
  // needs NEW feedback in the period — the standing cumulative rating alone must
  // not trigger a fresh email every period, or owners get the same numbers on
  // repeat. An all-time read (the button) treats the rating/count as feedback too.
  const hasNew = rows.length > 0 || gAll.length > 0;
  const hasAny = hasNew || gCount > 0 || gRating != null;
  if (windowed ? !hasNew : !hasAny) {
    return { error: windowed ? "No new guest feedback this period." : "No guest feedback yet to summarize." };
  }
  const showGoogleBlock = windowed ? gAll.length > 0 : (gAll.length > 0 || gCount > 0 || gRating != null);

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
  const googleLines = gCommented.map((r) => `- [${r.star_rating}/5] "${(r.comment ?? "").trim()}"`).join("\n");
  const googleHeader = `GOOGLE REVIEWS${gRating != null ? ` (overall ${gRating}/5${gCount ? ` across ${gCount} reviews` : ""})` : gCount ? ` (${gCount} reviews)` : ""}`;
  const googleBlock = showGoogleBlock
    ? `${googleHeader}:\n${gCommented.length ? googleLines : "(mostly star ratings — few or no written comments yet; report the rating and encourage collecting more written feedback)"}`
    : "";

  const blocks = [
    rows.length > 0 ? `SURVEY FEEDBACK (${rows.length} response${rows.length === 1 ? "" : "s"}):\n${surveyLines}` : "",
    googleBlock,
  ].filter(Boolean).join("\n\n");

  const scopeNote = windowed ? ` This is only the feedback from ${opts.periodLabel ?? "the recent period"} — summarize just what's here.` : "";
  const prompt = `Combined guest feedback for ${opts.orgName}.${
    mindset ? `\n\nThe owner's mindset (reflect its spirit): ${mindset}` : ""
  }\n\n${blocks}\n\nWrite the ${includeActions ? "three" : "two"}-section combined readout across both sources.${scopeNote}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: includeQuotes ? 1600 : 1000, system: buildSystem(includeActions, includeQuotes), messages: [{ role: "user", content: prompt }] }),
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
    return { error: null, summary: text, surveyCount: rows.length, googleCount: gAll.length || gCount };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate the summary. Try again." };
  }
}
