import "server-only";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiUsage } from "@/lib/ai/usage";
import type { Lang } from "@/lib/i18n";

// Translates owner-authored content (test questions, training, checklists) into
// a staff member's language on the fly, caching each unique string so it's only
// ever translated once per org + language. English is the source and returned
// as-is. On any failure we fall back to the original text — content should never
// disappear because a translation call hiccupped.

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function callTranslator(orgId: string, lang: Lang, texts: string[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return texts;
  const target = lang === "es" ? "Spanish (Latin American, as spoken by restaurant staff in the US)" : lang;
  const system = `You are a professional translator for restaurant training material. Translate each input string into ${target}.
Rules:
- Preserve meaning faithfully and keep the tone plain and clear for hourly staff.
- Keep proper nouns, brand names, and menu item names as-is (do not translate dish names).
- Keep any numbers, symbols, and line breaks exactly.
- Return ONLY a JSON object of the form {"out": ["...", "..."]} whose "out" array has exactly the same length and order as the input. No markdown, no commentary.`;
  const prompt = `Translate these ${texts.length} strings. Input JSON array:\n${JSON.stringify(texts)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 4000, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return texts;
  const data = await res.json();
  await recordAiUsage({ orgId, feature: "translation", model: "claude-sonnet-5", usage: data.usage });
  const raw: string = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  const json = first !== -1 && last > first ? cleaned.slice(first, last + 1) : cleaned;
  try {
    const parsed = JSON.parse(json) as { out?: unknown };
    const out = Array.isArray(parsed.out) ? parsed.out : [];
    if (out.length !== texts.length) return texts;
    return out.map((v, i) => (typeof v === "string" && v.trim() ? v : texts[i]));
  } catch {
    return texts;
  }
}

// Returns a lookup from each original string to its translation. Safe to call
// with English (returns identity) or with duplicates/blank strings.
export async function translateTexts(orgId: string, lang: Lang, texts: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (lang === "en") {
    for (const t of texts) map.set(t, t);
    return map;
  }
  const unique = [...new Set(texts.filter((t) => t && t.trim()))];
  if (unique.length === 0) {
    for (const t of texts) map.set(t, t);
    return map;
  }

  const admin = createAdminClient();
  const byHash = new Map<string, string>(); // source_hash -> original text
  for (const t of unique) byHash.set(hash(t), t);
  const hashes = [...byHash.keys()];

  // Pull whatever's already cached. A missing table/column (migration not yet
  // applied) just means everything falls through to originals below.
  const { data: cachedRows } = await admin
    .from("content_translations")
    .select("source_hash, translated")
    .eq("org_id", orgId)
    .eq("lang", lang)
    .in("source_hash", hashes);
  const cached = new Map<string, string>();
  for (const r of (cachedRows ?? []) as { source_hash: string; translated: string }[]) cached.set(r.source_hash, r.translated);

  const missHashes = hashes.filter((h) => !cached.has(h));
  const missTexts = missHashes.map((h) => byHash.get(h)!);

  let fresh: string[] = [];
  if (missTexts.length > 0) {
    try {
      fresh = await callTranslator(orgId, lang, missTexts);
    } catch {
      fresh = missTexts;
    }
    // Persist the ones that actually changed (skip identity fallbacks).
    const rows = missHashes
      .map((h, i) => ({ h, src: missTexts[i], out: fresh[i] }))
      .filter((r) => r.out && r.out !== r.src)
      .map((r) => ({ org_id: orgId, lang, source_hash: r.h, translated: r.out }));
    if (rows.length > 0) await admin.from("content_translations").upsert(rows, { onConflict: "org_id,lang,source_hash" });
  }
  const freshByHash = new Map<string, string>();
  missHashes.forEach((h, i) => freshByHash.set(h, fresh[i] ?? byHash.get(h)!));

  for (const t of texts) {
    if (!t || !t.trim()) { map.set(t, t); continue; }
    const h = hash(t);
    map.set(t, cached.get(h) ?? freshByHash.get(h) ?? t);
  }
  return map;
}
