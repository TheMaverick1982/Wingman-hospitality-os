import "server-only";
import { headers } from "next/headers";

// Known crawlers, social-preview scrapers, and scripting clients — the traffic
// that shouldn't count as a human "view".
const BOT_RE =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|whatsapp|telegram|discord|embedly|quora|pinterest|redditbot|applebot|yandex|baidu|duckduckbot|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|headlesschrome|lighthouse|gptbot|claudebot|oai-searchbot|ccbot|perplexity|python-requests|curl\/|wget|go-http|axios|node-fetch/i;

// Best-effort server-side bot detection from the User-Agent, so the Playbook view
// counter reflects human reads, not crawlers, share-link scrapers, or scripts. A
// missing UA is treated as non-human too (real browsers always send one).
export async function isBotRequest(): Promise<boolean> {
  try {
    const ua = (await headers()).get("user-agent") ?? "";
    if (!ua.trim()) return true;
    return BOT_RE.test(ua);
  } catch {
    return false; // can't read headers → don't suppress a possibly-real view
  }
}
