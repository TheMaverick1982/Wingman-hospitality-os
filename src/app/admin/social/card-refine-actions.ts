"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";
import { SOCIAL_BUCKET } from "@/lib/social";
import { renderSocialCard } from "@/lib/social-cards/render";
import { effectiveBrief } from "@/lib/social-cards/brief";
import { type CardSpec, type CardType, type SchemeKey } from "@/lib/social-cards/schemes";

const TYPES = new Set(["brand", "stat", "calc", "tip"]);
const SCHEMES_SET = new Set(["blue", "charcoal", "cream"]);

async function renderUploadAttach(postId: string, spec: CardSpec): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  let path: string;
  try {
    const bytes = await renderSocialCard(spec, 1080);
    path = `${randomUUID()}-card.png`;
    const { error } = await admin.storage.from(SOCIAL_BUCKET).upload(path, Buffer.from(bytes), { contentType: "image/png", upsert: false });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't render the card." };
  }
  const cardText = [spec.headline, spec.stat, spec.subhead, spec.number, spec.intro, spec.title, ...(spec.items ?? [])].filter(Boolean).join(" · ").slice(0, 400);
  const { error } = await admin.from("social_posts").update({ image_paths: [path], card_text: cardText, images_purged_at: null, updated_at: new Date().toISOString() }).eq("id", postId);
  if (error) return { error: error.message };
  revalidatePath("/admin/social");
  return { error: null };
}

// Direct, deterministic re-render: the owner types the card's line and picks the
// color — a "brand" headline card. Full manual control over the graphic.
export async function rerenderCardManual(postId: string, headline: string, scheme: string): Promise<{ error: string | null }> {
  if (!(await platformSectionActor("social"))) return { error: "Not authorized." };
  const text = (headline || "").trim();
  if (!text) return { error: "Enter the text for the card." };
  const sc = (SCHEMES_SET.has(scheme) ? scheme : "blue") as SchemeKey;
  return renderUploadAttach(postId, { type: "brand", scheme: sc, headline: text.slice(0, 160) });
}

function stripLoneSurrogates(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "").replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

// One-click AI regenerate: draft a fresh card from the post's own caption, in the
// brand voice. Replaces the graphic.
export async function regenerateCardAi(postId: string): Promise<{ error: string | null }> {
  if (!(await platformSectionActor("social"))) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { data: post } = await admin.from("social_posts").select("caption").eq("id", postId).maybeSingle();
  const caption = (post as { caption?: string } | null)?.caption ?? "";
  if (!caption.trim()) return { error: "This post has no caption to base a card on." };

  const { data: settings } = await admin.from("social_settings").select("content_brief").eq("id", 1).maybeSingle();
  const brief = effectiveBrief((settings as { content_brief?: string } | null)?.content_brief);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI is unavailable (no API key)." };

  const system = `${brief}

You design a single social CARD (a graphic — short text only, not a paragraph) for a post. Output ONLY one JSON object, no code fences, matching:
{"type":"brand"|"stat"|"calc"|"tip","scheme":"blue"|"charcoal"|"cream","headline":string,"stat":string,"subhead":string,"support":string,"intro":string,"number":string,"outro":string,"title":string,"items":[string]}
Use only the fields for the chosen type (brand→headline; stat→stat+subhead(+support); calc→intro+number+outro; tip→title+items[2-3]). Keep every line tight and punchy.`;
  const prompt = `Design one fresh card for this post caption:\n"""\n${caption.slice(0, 1200)}\n"""`;

  let spec: CardSpec;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 1000, system: stripLoneSurrogates(system), messages: [{ role: "user", content: stripLoneSurrogates(prompt) }] }),
    });
    if (!res.ok) return { error: `AI error ${res.status}.` };
    const data = await res.json();
    await recordAiUsage({ orgId: null, feature: "social_card_regen", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const obj = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    const type = (TYPES.has(obj.type) ? obj.type : "brand") as CardType;
    const scheme = (SCHEMES_SET.has(obj.scheme) ? obj.scheme : "blue") as SchemeKey;
    spec = { type, scheme, headline: obj.headline, stat: obj.stat, subhead: obj.subhead, support: obj.support, intro: obj.intro, number: obj.number, outro: obj.outro, title: obj.title, items: Array.isArray(obj.items) ? obj.items.slice(0, 3) : undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't generate a card." };
  }
  return renderUploadAttach(postId, spec);
}
