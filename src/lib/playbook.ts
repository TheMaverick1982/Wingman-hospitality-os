import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";

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
  scheduledFor: string | null;
  publishedAt: string | null;
  views: number;
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
    scheduledFor: (r.scheduled_for as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    views: Number(r.views ?? 0),
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
  let slug = base || "post";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data } = await admin.from("blog_posts").select("id").eq("slug", candidate).maybeSingle();
    if (!data || (ignoreId && (data as { id: string }).id === ignoreId)) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export async function createPost(userId: string, p: { title: string; excerpt: string; body: string; category: string; keywords: string[]; status?: PostStatus; scheduledFor?: string | null }): Promise<string | null> {
  const admin = createAdminClient();
  const slug = await uniqueSlug(slugify(p.title));
  const status = p.status ?? "draft";
  const { data } = await admin.from("blog_posts").insert({
    slug, title: p.title, excerpt: p.excerpt, body: p.body, category: p.category, keywords: p.keywords,
    status, scheduled_for: p.scheduledFor ?? null, published_at: status === "published" ? new Date().toISOString() : null, created_by: userId,
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
