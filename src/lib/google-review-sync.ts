import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { recordAiUsage } from "@/lib/ai/usage";
import { gbpListReviews, type GbpAccountRow, type GbpReview } from "@/lib/google-business";

// The AI's read of a location's Google reviews.
export type ReviewInsight = {
  headline: string; // one-line read of how they're doing
  sentiment: "excellent" | "strong" | "mixed" | "needs_attention";
  strengths: string[]; // what guests consistently love
  improvements: string[]; // where they can do better
  themes: { label: string; sentiment: "positive" | "negative" | "mixed"; mentions: number }[];
  actions: string[]; // concrete next steps grounded in the doctrine
  trend: string; // recent direction vs older reviews
};

function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

function extractJson(text: string): string {
  let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  return s;
}

const SYSTEM = `You are an elite restaurant operations coach. You read a restaurant location's Google reviews and give the owner an honest, specific, actionable read: what guests love, where they're slipping, the recurring themes, and concrete next moves. You are direct but constructive, and you ground everything in hospitality-first thinking.

${HOSPITALITY_DOCTRINE}

You output ONLY valid JSON matching the requested schema exactly — no markdown fences, no commentary.`;

const SHAPE = `{"headline": string, "sentiment": "excellent"|"strong"|"mixed"|"needs_attention", "strengths": string[], "improvements": string[], "themes": [{"label": string, "sentiment": "positive"|"negative"|"mixed", "mentions": number}], "actions": string[], "trend": string}`;

// Analyze a location's reviews into a structured insight. Returns null on failure
// (the sync still succeeds — reviews are stored, analysis just isn't refreshed).
export async function analyzeReviews(
  orgId: string,
  locationTitle: string,
  reviews: GbpReview[],
  averageRating: number | null,
): Promise<ReviewInsight | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const withText = reviews.filter((r) => r.comment.trim());
  if (withText.length === 0) return null;

  // Rating distribution across ALL reviews (even rating-only ones).
  const dist = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.stars >= 1 && r.stars <= 5) dist[r.stars - 1]++;
  // Most recent 80 with text (newest first) keep the prompt bounded.
  const sample = [...withText]
    .sort((a, b) => (b.createTime ?? "").localeCompare(a.createTime ?? ""))
    .slice(0, 80)
    .map((r) => `[${r.stars}★ ${r.createTime?.slice(0, 10) ?? "?"}] ${r.comment.replace(/\s+/g, " ").slice(0, 600)}`)
    .join("\n");

  const prompt = `Analyze the Google reviews for "${locationTitle}".

Average rating: ${averageRating ?? "unknown"} from ${reviews.length} reviews.
Rating distribution: 5★=${dist[4]}, 4★=${dist[3]}, 3★=${dist[2]}, 2★=${dist[1]}, 1★=${dist[0]}.

Reviews (newest first, "[stars date] text"):
${sample}

Give the owner:
- headline: one honest sentence on how this location is doing.
- sentiment: overall bucket.
- strengths: 2–5 things guests consistently praise (specific, quote the pattern, not generic).
- improvements: 2–5 concrete things to fix, drawn from real complaints (specific — name the actual issue).
- themes: the recurring topics (e.g. "service speed", "cleanliness", "value"), each with sentiment and roughly how many reviews mention it.
- actions: 3–5 concrete, hospitality-first next moves the owner/managers can take this month to raise the rating.
- trend: whether recent reviews are better, worse, or steady vs older ones.

Respond with ONLY valid JSON matching exactly:
${SHAPE}`;

  try {
    const res = await callAnthropic(apiKey, { model: "claude-sonnet-5", max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content: prompt }] });
    if (!res.ok) return null;
    const data = await res.json();
    await recordAiUsage({ orgId, feature: "google_review_analysis", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
    const parsed = JSON.parse(extractJson(text)) as ReviewInsight;
    if (!parsed || typeof parsed.headline !== "string") return null;
    // Light normalization / clamping.
    return {
      headline: String(parsed.headline).slice(0, 300),
      sentiment: ["excellent", "strong", "mixed", "needs_attention"].includes(parsed.sentiment) ? parsed.sentiment : "mixed",
      strengths: (parsed.strengths ?? []).map((s) => String(s).slice(0, 300)).slice(0, 6),
      improvements: (parsed.improvements ?? []).map((s) => String(s).slice(0, 300)).slice(0, 6),
      themes: (parsed.themes ?? []).slice(0, 10).map((t) => ({
        label: String(t.label ?? "").slice(0, 60),
        sentiment: ["positive", "negative", "mixed"].includes(t.sentiment) ? t.sentiment : "mixed",
        mentions: Math.max(0, Math.round(Number(t.mentions) || 0)),
      })),
      actions: (parsed.actions ?? []).map((s) => String(s).slice(0, 300)).slice(0, 6),
      trend: String(parsed.trend ?? "").slice(0, 300),
    };
  } catch {
    return null;
  }
}

// Pull + cache a mapped location's reviews, then refresh its AI insight. Returns
// the review count synced. Errors are recorded on the row and returned.
export async function syncLocationReviews(orgId: string, locationId: string): Promise<{ error: string | null; count?: number }> {
  const admin = createAdminClient();
  const { data: mapRow } = await admin
    .from("google_review_locations")
    .select("id, account_id, google_account_id, google_location_id, location_title")
    .eq("org_id", orgId)
    .eq("location_id", locationId)
    .maybeSingle();
  const map = mapRow as { id: string; account_id: string; google_account_id: string; google_location_id: string; location_title: string } | null;
  if (!map) return { error: "This location isn't connected to Google." };

  const { data: accRow } = await admin.from("google_business_accounts").select("*").eq("id", map.account_id).maybeSingle();
  const account = accRow as GbpAccountRow | null;
  if (!account) return { error: "The Google connection is missing — reconnect it." };

  const { error, reviews, averageRating } = await gbpListReviews(account, map.google_account_id, map.google_location_id);
  if (error || !reviews) {
    await admin.from("google_review_locations").update({ last_sync_status: `error: ${error ?? "unknown"}`, last_synced_at: new Date().toISOString() }).eq("id", map.id);
    return { error: error ?? "Couldn't read reviews from Google." };
  }

  // Upsert reviews (Google's review id is stable).
  if (reviews.length) {
    const rows = reviews.map((r) => ({
      org_id: orgId,
      location_id: locationId,
      google_review_id: r.reviewId,
      reviewer_name: r.reviewerName,
      star_rating: r.stars,
      comment: r.comment,
      reply_comment: r.reply,
      review_created_at: r.createTime,
      review_updated_at: r.updateTime,
      synced_at: new Date().toISOString(),
    }));
    await admin.from("google_reviews").upsert(rows, { onConflict: "org_id,google_review_id" });
  }

  const insight = await analyzeReviews(orgId, map.location_title, reviews, averageRating ?? null);
  await admin
    .from("google_review_locations")
    .update({
      average_rating: averageRating ?? null,
      review_count: reviews.length,
      last_synced_at: new Date().toISOString(),
      last_sync_status: "ok",
      ...(insight ? { insight, insight_generated_at: new Date().toISOString() } : {}),
    })
    .eq("id", map.id);

  return { error: null, count: reviews.length };
}

// Sync every mapped location for an org (used by the weekly cron).
export async function syncOrgReviews(orgId: string): Promise<{ locations: number; synced: number }> {
  const admin = createAdminClient();
  const { data: locs } = await admin.from("google_review_locations").select("location_id").eq("org_id", orgId);
  const ids = ((locs ?? []) as { location_id: string }[]).map((l) => l.location_id);
  let synced = 0;
  for (const id of ids) {
    const res = await syncLocationReviews(orgId, id);
    if (!res.error) synced++;
  }
  return { locations: ids.length, synced };
}
