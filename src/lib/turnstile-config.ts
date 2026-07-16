// Public Cloudflare Turnstile site key. Safe to ship to the browser — it only
// identifies the widget; the private secret (TURNSTILE_SECRET_KEY) stays on the
// server and is what actually validates a solved challenge.
//
// Env-driven so non-production environments (Preview/staging on *.vercel.app,
// which the production widget's hostname allowlist doesn't cover) can use
// Cloudflare's always-pass test key instead. Falls back to the real production
// site key when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so Production needs no
// change. Pair the test site key with the test secret on TURNSTILE_SECRET_KEY.
//   Preview test keys (Cloudflare, always pass):
//     site   = 1x00000000000000000000AA
//     secret = 1x0000000000000000000000000000000AA
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADzbdc5c3treGrRG";
