import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";
import { SOCIAL_BUCKET } from "@/lib/social";
import { renderSocialCard } from "./render";
import { effectiveBrief } from "./brief";
import { nextCadenceSlots } from "./cadence";
import { SCHEME_KEYS, type CardSpec, type CardType, type SchemeKey } from "./schemes";

// One AI-proposed post idea: the card (image) content + the per-platform copy.
type Idea = {
  card: {
    type: CardType;
    headline?: string;
    stat?: string;
    subhead?: string;
    support?: string;
    intro?: string;
    number?: string;
    outro?: string;
    title?: string;
    items?: string[];
  };
  facebook: { caption: string; first_comment?: string };
  instagram: { caption: string; first_comment?: string };
  linkedin: { caption: string; first_comment?: string };
  link?: string;
};

const CARD_TYPES = new Set<string>(["brand", "stat", "calc", "tip"]);

// Remove unpaired UTF-16 surrogates. Slicing a caption mid-emoji can leave a lone
// surrogate, which Anthropic's JSON parser rejects ("no low surrogate in string").
function stripLoneSurrogates(s: string): string {
  return s
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

async function callModel(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Wingman's AI is temporarily unavailable (no API key).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system: stripLoneSurrogates(system), messages: [{ role: "user", content: stripLoneSurrogates(prompt) }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  await recordAiUsage({ orgId: null, feature: "social_generate", model: "claude-sonnet-5", usage: data.usage });
  return (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
}

function extractJsonArray(text: string): unknown[] {
  let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

// Coerce an AI idea's card into a valid CardSpec for the given scheme, dropping
// fields that don't belong to the chosen type.
function toCardSpec(card: Idea["card"], scheme: SchemeKey): CardSpec | null {
  const type = (CARD_TYPES.has(card.type) ? card.type : "brand") as CardType;
  const base: CardSpec = { type, scheme };
  if (type === "stat") {
    if (!card.stat || !card.subhead) return null;
    return { ...base, stat: card.stat, subhead: card.subhead, support: card.support };
  }
  if (type === "calc") {
    if (!card.number) return null;
    return { ...base, intro: card.intro, number: card.number, outro: card.outro };
  }
  if (type === "tip") {
    const items = (card.items ?? []).filter((x) => x && x.trim()).slice(0, 3);
    if (!card.title || items.length < 2) return null;
    return { ...base, title: card.title, items };
  }
  if (!card.headline) return null;
  return { ...base, headline: card.headline };
}

async function uploadCardPng(bytes: Uint8Array): Promise<string | null> {
  const admin = createAdminClient();
  const path = `${randomUUID()}-card.png`;
  const { error } = await admin.storage.from(SOCIAL_BUCKET).upload(path, Buffer.from(bytes), { contentType: "image/png", upsert: false });
  return error ? null : path;
}

const SCHEMA = `[
  {
    "card": { "type": "brand"|"stat"|"calc"|"tip",
      "headline": string,            // brand only — the whole line
      "stat": string, "subhead": string, "support": string,  // stat only (support optional)
      "intro": string, "number": string, "outro": string,     // calc only
      "title": string, "items": [string]                       // tip only (2-3 short items)
    },
    "facebook":  { "caption": string, "first_comment": string },
    "instagram": { "caption": string, "first_comment": string },
    "linkedin":  { "caption": string, "first_comment": string },
    "link": string   // the CTA URL (used on Facebook + LinkedIn; Instagram says "link in bio")
  }
]`;

// Generate `count` post ideas and insert them as DRAFT social posts (one each for
// Facebook, Instagram — with a rendered card — and LinkedIn, text only). Drafts
// carry the next cadence slots but never publish until the owner approves them.
export type GenPlatform = "facebook" | "instagram" | "linkedin";

export async function generateSocialDrafts(
  count: number,
  platforms: GenPlatform[] = ["facebook", "instagram", "linkedin"],
  focus?: string
): Promise<{ error: string | null; created: number }> {
  const n = Math.max(1, Math.min(15, Math.round(count)));
  const want = new Set<GenPlatform>((platforms.length ? platforms : ["facebook", "instagram", "linkedin"]).filter((p) => p === "facebook" || p === "instagram" || p === "linkedin"));
  const needCard = want.has("facebook") || want.has("instagram");
  const admin = createAdminClient();
  const { data: settings } = await admin.from("social_settings").select("content_brief").eq("id", 1).maybeSingle();
  const brief = effectiveBrief((settings as { content_brief?: string } | null)?.content_brief);

  // Slot after the furthest-out scheduled OR draft post, so nothing overlaps.
  const { data: furthestRows } = await admin
    .from("social_posts")
    .select("scheduled_at")
    .in("status", ["scheduled", "draft"])
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: false })
    .limit(1);
  const furthest = (furthestRows?.[0] as { scheduled_at: string } | undefined)?.scheduled_at ?? null;
  const slots = nextCadenceSlots(furthest, n);

  // Recent captions + card fingerprints to steer away from repeats. card_text is
  // kept even after the image file is purged, so this is our no-repeat memory for
  // the graphics without storing any images.
  const { data: recent } = await admin.from("social_posts").select("caption, card_text").order("created_at", { ascending: false }).limit(60);
  const avoid = [
    ...new Set(
      (recent ?? [])
        .flatMap((r) => [(r as { caption?: string }).caption, (r as { card_text?: string }).card_text])
        .filter((x): x is string => Boolean(x && x.trim()))
    ),
  ].slice(0, 60);

  const system = `${brief}

You output ONLY a valid JSON array (no code fences, no commentary) of exactly ${n} post ideas matching this schema:
${SCHEMA}

Rules:
- Rotate card "type" and content mix; never repeat a hook, stat, or card headline within the batch.
- Facebook & Instagram captions cover the SAME idea but are written natively for each (IG can use "link in bio"; put hashtags in first_comment). LinkedIn is a longer, more professional take in Brian's voice (2-4 short paragraphs), links work.
- HARD RULE: Brian is a marketing/ops expert who has worked WITH restaurants — he does NOT own or run one. NO post (especially LinkedIn) may imply he's a restaurant owner/operator. Never write "my restaurant", "our floor", "our guests", "my staff"; refer to restaurants/operators in the third person.
- Card text is SHORT and punchy — it's a graphic, not a paragraph. Keep headlines/subheads tight.
- "link" is one of the real CTA URLs and should vary across the batch.`;

  const channelLine = `Only write captions for these channels: ${[...want].join(", ")}. Leave the other channel fields out.${needCard ? "" : " (No card is needed.)"}`;
  const focusLine = focus && focus.trim() ? `\n\nFocus this batch on: ${focus.trim().slice(0, 600)} (still follow all the voice/mix/honesty rules above).` : "";
  const prompt = `Generate ${n} fresh post ideas now. ${channelLine}${focusLine}${avoid.length ? `\n\nDo NOT repeat or closely echo any of these recent captions:\n- ${avoid.map((c) => c.slice(0, 120)).join("\n- ")}` : ""}`;

  let ideas: Idea[];
  try {
    const text = await callModel(system, prompt, Math.min(16000, 2000 + n * 900));
    ideas = extractJsonArray(text) as Idea[];
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed.", created: 0 };
  }
  if (!Array.isArray(ideas) || ideas.length === 0) return { error: "The generator returned nothing. Try again.", created: 0 };

  const rows: Record<string, unknown>[] = [];
  let created = 0;
  for (let i = 0; i < ideas.length && i < slots.length; i++) {
    const idea = ideas[i];
    if (!idea?.card) continue;
    const scheme = SCHEME_KEYS[i % SCHEME_KEYS.length]; // batch color rotation (Facebook's card)
    // Instagram gets a DIFFERENT color scheme than Facebook so the two channels
    // never post an identical image — same content, different look.
    const igScheme = SCHEME_KEYS[(i + 1) % SCHEME_KEYS.length];
    const spec = toCardSpec(idea.card, scheme);
    if (!spec) continue;

    // Render a distinct card per card-channel (FB/IG): same copy, different color
    // scheme. LinkedIn is text-only, so it needs no card.
    const renderFor = async (sc: SchemeKey): Promise<string[]> => {
      try {
        const path = await uploadCardPng(await renderSocialCard({ ...spec, scheme: sc }, 1080));
        return path ? [path] : [];
      } catch (e) {
        console.error("[social] card render/upload failed", e); // still create the drafts (owner can add art)
        return [];
      }
    };
    const fbImg = want.has("facebook") ? await renderFor(scheme) : [];
    const igImg = want.has("instagram") ? await renderFor(igScheme) : [];

    const slot = slots[i];
    const link = typeof idea.link === "string" && idea.link.startsWith("http") ? idea.link : "https://www.joinwingman.app/demo";
    // Compact fingerprint of the card's visible copy — our no-repeat memory.
    const cardText = [spec.headline, spec.stat, spec.subhead, spec.number, spec.intro, spec.title, ...(spec.items ?? [])].filter(Boolean).join(" · ").slice(0, 400);

    let made = 0;
    if (want.has("facebook") && idea.facebook?.caption) { rows.push({ caption: idea.facebook.caption.trim(), link, first_comment: idea.facebook.first_comment?.trim() || null, platforms: ["facebook"], format: "feed", scheduled_at: slot, image_paths: fbImg, card_text: cardText, status: "draft" }); made++; }
    if (want.has("instagram") && idea.instagram?.caption) { rows.push({ caption: idea.instagram.caption.trim(), link: null, first_comment: idea.instagram.first_comment?.trim() || null, platforms: ["instagram"], format: "feed", scheduled_at: slot, image_paths: igImg, card_text: cardText, status: "draft" }); made++; }
    if (want.has("linkedin") && idea.linkedin?.caption) { rows.push({ caption: idea.linkedin.caption.trim(), link, first_comment: idea.linkedin.first_comment?.trim() || null, platforms: ["linkedin"], format: "feed", scheduled_at: slot, image_paths: [], status: "draft" }); made++; }
    if (made > 0) created++;
  }

  if (rows.length === 0) return { error: "Couldn't build any valid posts. Try again.", created: 0 };
  const { error } = await admin.from("social_posts").insert(rows);
  if (error) return { error: error.message, created: 0 };

  await admin.from("social_settings").update({ content_generated_at: new Date().toISOString() }).eq("id", 1);
  return { error: null, created };
}
