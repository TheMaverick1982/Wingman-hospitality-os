import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";
import { getSocialSettings, isConnected, GRAPH } from "@/lib/social-meta";

// The Playbook — public content hub. Data access + AI drafting. Reads happen via
// the service-role client (filtered to published for public pages); writes are
// gated by platform-admin server code.

export type PostStatus = "draft" | "scheduled" | "published";
export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  keywords: string[];
  status: PostStatus;
  approved: boolean;
  scheduledFor: string | null;
  publishedAt: string | null;
  facebookPostedAt: string | null;
  views: number;
  // Set for newsjack drafts — the news story the post rides (shown in review).
  sourceUrl: string | null;
};

export const PLAYBOOK_CATEGORIES = ["Retention", "Hiring", "Training", "Menu & LTOs", "Leadership", "Franchising"] as const;

function mapPost(r: Record<string, unknown>): Post {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    excerpt: String(r.excerpt ?? ""),
    body: String(r.body ?? ""),
    category: String(r.category ?? "General"),
    keywords: (r.keywords as string[]) ?? [],
    status: (r.status as PostStatus) ?? "draft",
    approved: Boolean(r.approved),
    scheduledFor: (r.scheduled_for as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    facebookPostedAt: (r.facebook_posted_at as string) ?? null,
    views: Number(r.views ?? 0),
    sourceUrl: (r.source_url as string) ?? null,
  };
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

// ---- Public reads ----
export async function listPublished(): Promise<Post[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(100);
  return ((data ?? []) as Record<string, unknown>[]).map(mapPost);
}

export async function getPublishedBySlug(slug: string): Promise<Post | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  return data ? mapPost(data as Record<string, unknown>) : null;
}

// Any-status lookup by slug — used by the OG share-card image so the owner can
// preview a card for a draft/scheduled post before it publishes.
export async function getBySlugAny(slug: string): Promise<Post | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("*").eq("slug", slug).maybeSingle();
  return data ? mapPost(data as Record<string, unknown>) : null;
}

export async function incrementViews(id: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("blog_posts").select("views").eq("id", id).maybeSingle();
    const v = Number((data as { views?: number } | null)?.views ?? 0) + 1;
    await admin.from("blog_posts").update({ views: v }).eq("id", id);
  } catch {
    /* best-effort */
  }
}

// ---- Admin ----
export async function listAllPosts(): Promise<Post[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as Record<string, unknown>[]).map(mapPost);
}

export async function getPostById(id: string): Promise<Post | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("*").eq("id", id).maybeSingle();
  return data ? mapPost(data as Record<string, unknown>) : null;
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const admin = createAdminClient();
  const slug = base || "post";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data } = await admin.from("blog_posts").select("id").eq("slug", candidate).maybeSingle();
    if (!data || (ignoreId && (data as { id: string }).id === ignoreId)) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export async function createPost(userId: string | null, p: { title: string; excerpt: string; body: string; category: string; keywords: string[]; status?: PostStatus; scheduledFor?: string | null; sourceUrl?: string | null }): Promise<string | null> {
  const admin = createAdminClient();
  const slug = await uniqueSlug(slugify(p.title));
  const status = p.status ?? "draft";
  const { data } = await admin.from("blog_posts").insert({
    slug, title: p.title, excerpt: p.excerpt, body: p.body, category: p.category, keywords: p.keywords,
    status, scheduled_for: p.scheduledFor ?? null, published_at: status === "published" ? new Date().toISOString() : null,
    source_url: p.sourceUrl ?? null, created_by: userId,
  }).select("id").single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function updatePost(id: string, p: { title: string; excerpt: string; body: string; category: string; keywords: string[] }): Promise<void> {
  const admin = createAdminClient();
  await admin.from("blog_posts").update({ title: p.title, excerpt: p.excerpt, body: p.body, category: p.category, keywords: p.keywords, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function setPostStatus(id: string, status: PostStatus, scheduledFor?: string | null): Promise<void> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "published") patch.published_at = new Date().toISOString();
  if (status === "scheduled") patch.scheduled_for = scheduledFor ?? null;
  await admin.from("blog_posts").update(patch).eq("id", id);
}

export async function deletePost(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("blog_posts").delete().eq("id", id);
}

// ---- AI drafting ----
export type DraftInput = { topic?: string; category: string; existingTitles: string[] };
export type Draft = { title: string; excerpt: string; body: string; category: string; keywords: string[] };

// Human-voiced style rules — no emojis, no em dashes, no AI-tell phrasing.
const STYLE = `Write like a sharp, experienced restaurant operator talking to another operator. Rules you must follow:
- Do NOT use emojis.
- Do NOT use em dashes or en dashes (— or –). Use a period, a comma, or the word "and" instead.
- Do NOT use AI-tell phrasing like "in today's fast-paced world", "unlock", "elevate", "dive in", "game-changer", "in conclusion", "moreover", "furthermore", "it's important to note".
- Plain, direct, confident. Short paragraphs. Concrete examples from real restaurant life.
- Every post gives genuinely actionable advice a manager could use this week.
- Tie the advice to how Wingman helps where it fits naturally, without being a sales pitch.`;

export async function generateDraft(input: DraftInput): Promise<Draft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const system = `You write "The Playbook", the content library for Wingman, a hospitality guest-retention platform for restaurants (training, hiring, daily accountability, guest bounce-back, and reporting).
${STYLE}
Return ONLY JSON: {"title": string, "excerpt": string (one sentence, under 160 chars), "body": string (600-900 words, plain paragraphs separated by blank lines, no markdown headers required but you may use short bold labels), "keywords": [string] (6-10 SEO keywords), "category": string}.`;
  const avoid = input.existingTitles.length ? `\nDo NOT repeat or closely overlap these existing titles: ${input.existingTitles.slice(0, 60).join("; ")}` : "";
  const prompt = `Write one post in the "${input.category}" category.${input.topic ? ` Topic: ${input.topic}.` : " Pick a specific, useful angle a restaurant operator would search for."} It must be keyword-rich, genuinely actionable, and end with a short call to action inviting the reader to see how Wingman helps.${avoid}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3000, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await recordAiUsage({ orgId: "platform", feature: "playbook_draft", model: "claude-sonnet-5", usage: data.usage }).catch(() => {});
    const raw = ((data.content ?? []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"), last = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(first !== -1 && last > first ? cleaned.slice(first, last + 1) : cleaned) as Partial<Draft>;
    if (!parsed.title || !parsed.body) return null;
    // Strip any dashes the model slipped in, to enforce the human-voice rule.
    const scrub = (s: string) => s.replace(/\s[—–]\s/g, ", ").replace(/[—–]/g, ", ");
    return {
      title: scrub(String(parsed.title)).slice(0, 140),
      excerpt: scrub(String(parsed.excerpt ?? "")).slice(0, 200),
      body: scrub(String(parsed.body)),
      keywords: (Array.isArray(parsed.keywords) ? parsed.keywords : []).map(String).slice(0, 10),
      category: String(parsed.category ?? input.category),
    };
  } catch {
    return null;
  }
}

// ---- Scheduling (Tue/Thu noon ET) + approval + auto-publish ----

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
export const RUNWAY_MIN = 4;        // generate more when fewer than this remain scheduled
export const BATCH_SIZE = 8;        // ~one month at 2/week

function etWeekday(dt: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(dt);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

// The UTC instant of 12:00 America/New_York on the given UTC calendar day.
function noonEtInstant(y: number, mo: number, d: number): Date {
  const guess = new Date(Date.UTC(y, mo, d, 16, 0, 0)); // 16:00 UTC ~= noon ET (EDT)
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).formatToParts(guess).find((p) => p.type === "hour")?.value ?? "12";
  const adj = 12 - Number(hourStr);
  return new Date(guess.getTime() + adj * 3600000);
}

// The next `count` Tue/Thu-noon-ET instants strictly after fromMs.
export function nextSlots(count: number, fromMs: number): string[] {
  const out: string[] = [];
  const cursor = new Date(fromMs);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 120 && out.length < count; i++) {
    const day = new Date(cursor.getTime() + i * 86400000);
    const slot = noonEtInstant(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
    const wd = etWeekday(slot);
    if ((wd === 2 || wd === 4) && slot.getTime() > fromMs) out.push(slot.toISOString());
  }
  return out;
}

export async function scheduledFuture(): Promise<Post[]> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await admin.from("blog_posts").select("*").eq("status", "scheduled").gte("scheduled_for", nowIso).order("scheduled_for");
  return ((data ?? []) as Record<string, unknown>[]).map(mapPost);
}

export async function lastScheduledDate(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("scheduled_for").eq("status", "scheduled").order("scheduled_for", { ascending: false }).limit(1).maybeSingle();
  return (data as { scheduled_for?: string } | null)?.scheduled_for ?? null;
}

export async function approvePost(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("blog_posts").update({ approved: true, updated_at: new Date().toISOString() }).eq("id", id);
}

// Generate `count` posts and schedule them into the next open Tue/Thu noon-ET
// slots (skipping ones already taken), rotating categories and deduping titles.
// They land as scheduled + NOT approved, awaiting review.
export async function generateAndSchedule(userId: string | null, count: number): Promise<{ created: number; error: string | null }> {
  const admin = createAdminClient();
  const existing = (await listAllPosts()).map((p) => p.title);
  const taken = new Set((await scheduledFuture()).map((p) => p.scheduledFor));
  // Find open slots after the latest currently-scheduled date (so we extend the runway).
  const last = await lastScheduledDate();
  const fromMs = Math.max(Date.now(), last ? new Date(last).getTime() : 0);
  const slots = nextSlots(count + taken.size + 4, fromMs).filter((s) => !taken.has(s)).slice(0, count);

  let created = 0;
  for (let i = 0; i < slots.length; i++) {
    const category = PLAYBOOK_CATEGORIES[(existing.length + created + i) % PLAYBOOK_CATEGORIES.length];
    const draft = await generateDraft({ category, existingTitles: [...existing, ...Array(created).fill("")].filter(Boolean) });
    if (!draft) continue;
    existing.push(draft.title);
    const slug = await uniqueSlug(slugify(draft.title));
    await admin.from("blog_posts").insert({
      slug, title: draft.title, excerpt: draft.excerpt, body: draft.body, category: draft.category, keywords: draft.keywords,
      status: "scheduled", approved: false, scheduled_for: slots[i], created_by: userId,
    });
    created += 1;
  }
  return { created, error: created === 0 ? "Couldn't generate posts (the AI may be unavailable)." : null };
}

// Post a published article to the connected Facebook page (best-effort).
async function postToFacebook(title: string, excerpt: string, slug: string): Promise<string | null> {
  try {
    const s = await getSocialSettings();
    if (!isConnected(s) || !s) return null;
    const url = `${SITE}/playbook/${slug}`;
    const message = `${title}\n\n${excerpt}`.trim();
    const res = await fetch(`${GRAPH}/${s.fb_page_id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, link: url, access_token: s.page_access_token }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return res.ok ? data.id ?? "posted" : null;
  } catch {
    return null;
  }
}

// Mark a post published and share it to Facebook (once). Used by both the
// scheduled cron and the manual "Publish now" button so every publish path
// lands on the site AND the connected Facebook page. Idempotent on FB: if the
// post already has facebook_posted_at, it won't be posted again.
export async function publishAndShare(id: string): Promise<{ facebook: "posted" | "skipped" | "already" }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await admin.from("blog_posts").select("slug, title, excerpt, facebook_posted_at").eq("id", id).single();
  const post = data as { slug: string; title: string; excerpt: string; facebook_posted_at: string | null } | null;
  if (!post) return { facebook: "skipped" };

  await admin.from("blog_posts").update({ status: "published", published_at: nowIso, updated_at: nowIso }).eq("id", id);

  if (post.facebook_posted_at) return { facebook: "already" };
  const fb = await postToFacebook(post.title, post.excerpt, post.slug);
  if (fb) {
    await admin.from("blog_posts").update({ facebook_posted_at: nowIso }).eq("id", id);
    return { facebook: "posted" };
  }
  return { facebook: "skipped" };
}

// Share an already-published post to Facebook (for posts published before FB
// was connected, or that failed the first time). No-op if already shared.
export async function shareToFacebook(id: string): Promise<{ ok: boolean; already: boolean; error: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin.from("blog_posts").select("slug, title, excerpt, facebook_posted_at").eq("id", id).single();
  const post = data as { slug: string; title: string; excerpt: string; facebook_posted_at: string | null } | null;
  if (!post) return { ok: false, already: false, error: "Post not found." };
  if (post.facebook_posted_at) return { ok: true, already: true, error: null };
  const s = await getSocialSettings();
  if (!isConnected(s)) return { ok: false, already: false, error: "Facebook isn't connected. Connect a page under Admin → Social first." };
  const fb = await postToFacebook(post.title, post.excerpt, post.slug);
  if (!fb) return { ok: false, already: false, error: "Facebook rejected the post. Re-check the page connection under Admin → Social." };
  await admin.from("blog_posts").update({ facebook_posted_at: new Date().toISOString() }).eq("id", id);
  return { ok: true, already: false, error: null };
}

// Publish approved + scheduled posts whose time has arrived. Posts each to
// Facebook. Returns the slugs published.
export async function publishDuePosts(): Promise<string[]> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await admin.from("blog_posts").select("id, slug").eq("status", "scheduled").eq("approved", true).lte("scheduled_for", nowIso);
  const due = (data ?? []) as { id: string; slug: string }[];
  const published: string[] = [];
  for (const p of due) {
    await publishAndShare(p.id);
    published.push(p.slug);
  }
  return published;
}
