import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app";

// Private surfaces that no crawler should index (the signed-in app, auth, APIs).
const DISALLOW = ["/dashboard", "/settings", "/admin", "/onboarding", "/auth", "/set-password", "/api", "/founders"];

// The AI crawlers we explicitly welcome. Two jobs here:
//  1. Training/index crawlers (GPTBot, ClaudeBot, anthropic-ai, Google-Extended,
//     CCBot, Applebot-Extended) — being in their corpus is how an LLM learns what
//     Wingman *is* and can recommend it unprompted.
//  2. Live retrieval / answer crawlers (OAI-SearchBot, ChatGPT-User, Claude-Web,
//     PerplexityBot, Perplexity-User) — these fetch pages in real time to cite in
//     answers, so allowing them is what lets Wingman show up *with a link* when
//     someone asks ChatGPT/Perplexity/Claude "what's the best restaurant
//     retention software."
// We give each the same access as a search engine (everything but the private
// surfaces). Listing them explicitly is a clear, machine-readable "yes" — some
// operators block these by default, so being deliberate matters.
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "cohere-ai",
  "Bytespider",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_AGENTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
