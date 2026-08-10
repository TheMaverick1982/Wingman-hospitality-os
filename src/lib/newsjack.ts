import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";
import { sendEmail } from "@/lib/email";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { createPost } from "@/lib/playbook";

// Newsjacking: scan restaurant-industry news, let the AI pick the one story most
// worth riding, draft a Playbook post grounded in the doctrine (with a hard
// sensitivity guardrail), save it as a pending draft, and email the platform
// admins to review and publish. Nothing publishes without a human. See the daily
// cron at /api/cron/newsjack.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

// Restaurant-industry RSS feeds. Best-effort: a feed that fails/moves is skipped,
// and the NewsData.io sweep (below) provides breadth. Tune this list from real runs.
const RSS_FEEDS = [
  "https://www.restaurantdive.com/feeds/news/",
  "https://www.modernrestaurantmanagement.com/feed/",
  "https://www.qsrmagazine.com/rss.xml",
  "https://www.restaurantbusinessonline.com/rss.xml",
  "https://www.nrn.com/rss.xml",
];

export type NewsItem = { title: string; url: string; summary: string; source: string };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function firstTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1]) : "";
}

async function fetchRss(url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "WingmanNewsjack/1.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const source = new URL(url).hostname.replace(/^www\./, "");
    const items: NewsItem[] = [];
    for (const b of (xml.match(/<item[\s\S]*?<\/item>/gi) ?? []).slice(0, 12)) {
      const title = firstTag(b, "title");
      const linkMatch = b.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const link = linkMatch ? decode(linkMatch[1]) : "";
      const summary = firstTag(b, "description").slice(0, 400);
      if (title && link.startsWith("http")) items.push({ title, url: link, summary, source });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchNewsData(): Promise<NewsItem[]> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) return [];
  try {
    const q = encodeURIComponent('restaurant OR hospitality OR "quick service"');
    const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${key}&q=${q}&language=en`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { title?: string; link?: string; description?: string; source_id?: string }[] };
    return (data.results ?? [])
      .slice(0, 15)
      .map((r) => ({ title: (r.title ?? "").trim(), url: (r.link ?? "").trim(), summary: (r.description ?? "").slice(0, 400), source: r.source_id ?? "newsdata" }))
      .filter((n) => n.title && n.url.startsWith("http"));
  } catch {
    return [];
  }
}

async function unseen(items: NewsItem[]): Promise<NewsItem[]> {
  const byUrl = new Map(items.map((i) => [i.url, i]));
  const urls = [...byUrl.keys()];
  if (urls.length === 0) return [];
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("newsjack_seen").select("url").in("url", urls);
    const seen = new Set(((data ?? []) as { url: string }[]).map((r) => r.url));
    return urls.filter((u) => !seen.has(u)).map((u) => byUrl.get(u)!);
  } catch {
    return [...byUrl.values()];
  }
}

async function markSeen(items: NewsItem[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("newsjack_seen").upsert(items.map((i) => ({ url: i.url })), { onConflict: "url", ignoreDuplicates: true });
  } catch {
    /* best-effort */
  }
}

type NewsjackDraft = { url: string; title: string; excerpt: string; body: string; keywords: string[]; category: string };

async function draftFrom(candidates: NewsItem[]): Promise<NewsjackDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || candidates.length === 0) return null;
  const list = candidates.slice(0, 15).map((c, i) => `${i + 1}. [${c.source}] ${c.title}\n   url: ${c.url}\n   ${c.summary}`).join("\n\n");
  const system = `You write "The Playbook", the content library for Wingman, a hospitality guest-retention platform for restaurants (training, hiring, daily accountability, guest bounce-back, reporting).
You are NEWSJACKING: from today's restaurant-industry headlines, pick the ONE story you can tie to a genuine hospitality / retention / operations insight for restaurant operators, and write a short, timely post around it.

Ground your angle in this doctrine (apply it; do not quote it):
${HOSPITALITY_DOCTRINE}

Hard rules:
- SKIP anything about a death, tragedy, violent crime, a lawsuit or scandal naming a specific person, or a politically radioactive topic. If nothing is genuinely appropriate to newsjack today, return {"skip": true}.
- Reference the actual news specifically (what happened), THEN give a useful take an operator could act on this week, and end with a soft, non-salesy nod to how Wingman helps.
- Do NOT use emojis. Do NOT use em or en dashes (— –); use a period, a comma, or "and". Avoid AI-tell phrasing ("in today's fast-paced world", "unlock", "elevate", "dive in", "game-changer", "in conclusion", "moreover", "furthermore").
- Plain, direct, confident operator voice. Short paragraphs.
Return ONLY JSON: {"skip": boolean, "url": string (the EXACT url of the item you chose, copied from the list), "title": string, "excerpt": string (one sentence, under 160 chars), "body": string (450-700 words, plain paragraphs separated by blank lines), "keywords": [string] (6-10 SEO keywords), "category": string (one of: Retention, Hiring, Training, Menu & LTOs, Leadership, Franchising)}.`;
  const prompt = `Today's candidate headlines:\n\n${list}\n\nPick the single best one to newsjack (or skip), then write the post.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3000, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await recordAiUsage({ orgId: "platform", feature: "newsjack_draft", model: "claude-sonnet-5", usage: data.usage }).catch(() => {});
    const raw = ((data.content ?? []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"), last = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(first !== -1 && last > first ? cleaned.slice(first, last + 1) : cleaned) as Partial<NewsjackDraft> & { skip?: boolean };
    if (parsed.skip || !parsed.title || !parsed.body || !parsed.url) return null;
    // The chosen url must be one we actually surfaced — never a hallucinated source.
    if (!candidates.some((c) => c.url === parsed.url)) return null;
    const scrub = (s: string) => s.replace(/\s[—–]\s/g, ", ").replace(/[—–]/g, ", ");
    return {
      url: String(parsed.url),
      title: scrub(String(parsed.title)).slice(0, 140),
      excerpt: scrub(String(parsed.excerpt ?? "")).slice(0, 200),
      body: scrub(String(parsed.body)),
      keywords: (Array.isArray(parsed.keywords) ? parsed.keywords : []).map(String).slice(0, 10),
      category: String(parsed.category ?? "Leadership"),
    };
  } catch {
    return null;
  }
}

async function platformAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data: profs } = await admin.from("profiles").select("id").eq("is_platform_admin", true);
  const ids = ((profs ?? []) as { id: string }[]).map((p) => p.id);
  const emails: string[] = [];
  for (const id of ids.slice(0, 10)) {
    try {
      const { data } = await admin.auth.admin.getUserById(id);
      const e = data?.user?.email;
      if (e) emails.push(e);
    } catch {
      /* skip */
    }
  }
  return [...new Set(emails)];
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

export type NewsjackOutcome = "drafted" | "skipped" | "no_fresh_news" | "error";
export type NewsjackRun = { ranAt: string; outcome: NewsjackOutcome; detail: string; considered: number; trigger: string };

// Record one scan's outcome so the Admin → Playbook page can show the scanner is
// alive even on days it drafts nothing. Best-effort — never blocks a run.
async function recordRun(outcome: NewsjackOutcome, detail: string, considered: number, postId: string | null, trigger: "cron" | "manual"): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("newsjack_runs").insert({ outcome, detail: detail.slice(0, 300), considered, post_id: postId, trigger });
  } catch {
    /* best-effort */
  }
}

// The most recent scan, for the admin status line. Null if none / unavailable.
export async function lastNewsjackRun(): Promise<NewsjackRun | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("newsjack_runs")
      .select("ran_at, outcome, detail, considered, trigger")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const r = data as { ran_at: string; outcome: string; detail: string; considered: number; trigger: string };
    return { ranAt: r.ran_at, outcome: r.outcome as NewsjackOutcome, detail: r.detail, considered: r.considered, trigger: r.trigger };
  } catch {
    return null;
  }
}

// The daily loop: scan → dedup → pick + draft → save as a pending draft → email
// the platform admins. Returns a small summary for the cron response, and logs
// its outcome to newsjack_runs so a quiet day is still visibly "ran ok".
export async function runDailyNewsjack(trigger: "cron" | "manual" = "cron"): Promise<{ drafted: boolean; title?: string; considered: number }> {
  try {
    const feeds = await Promise.all(RSS_FEEDS.map(fetchRss));
    const all = [...(await fetchNewsData()), ...feeds.flat()];
    const fresh = await unseen(all);
    await markSeen(fresh);
    if (fresh.length === 0) {
      await recordRun("no_fresh_news", "No new headlines since the last scan.", 0, null, trigger);
      return { drafted: false, considered: 0 };
    }

    const draft = await draftFrom(fresh);
    if (!draft) {
      await recordRun("skipped", "Nothing timely and safe to newsjack today.", fresh.length, null, trigger);
      return { drafted: false, considered: fresh.length };
    }

    const source = fresh.find((c) => c.url === draft.url);
    const id = await createPost(null, {
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      category: draft.category,
      keywords: draft.keywords,
      status: "draft",
      sourceUrl: draft.url,
    });
    if (!id) {
      await recordRun("error", "Drafted a post but couldn't save it.", fresh.length, null, trigger);
      return { drafted: false, considered: fresh.length };
    }
    await recordRun("drafted", draft.title, fresh.length, id, trigger);

    const emails = await platformAdminEmails();
    if (emails.length > 0) {
      await sendEmail({
        to: emails,
        subject: `Newsjack draft ready: ${draft.title}`,
        html: `<p>A timely Playbook post is drafted and waiting for your review:</p>
<p style="font-size:16px"><strong>${esc(draft.title)}</strong><br/><span style="color:#555">${esc(draft.excerpt)}</span></p>
<p>Riding this story${source ? ` (${esc(source.source)})` : ""}: <a href="${esc(draft.url)}">${esc(source?.title ?? draft.url)}</a></p>
<p><a href="${SITE}/admin/playbook">Review, edit, and publish in Admin &rarr; Playbook</a></p>
<p style="color:#888;font-size:13px">Nothing publishes until you approve it. News moves fast, so try to review it today.</p>`,
      }).catch(() => undefined);
    }
    return { drafted: true, title: draft.title, considered: fresh.length };
  } catch (e) {
    await recordRun("error", String(e).slice(0, 200), 0, null, trigger);
    return { drafted: false, considered: 0 };
  }
}
