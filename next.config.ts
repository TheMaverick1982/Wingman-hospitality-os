import type { NextConfig } from "next";

// A deliberately PARTIAL Content-Security-Policy. It sets only the directives
// that are safe to enforce without an allowlist audit of every script/style/
// analytics origin -- so it cannot white-screen the live app -- while still
// closing real attack classes:
//   * frame-ancestors 'self'  -> clickjacking (modern replacement for X-Frame-Options)
//   * base-uri 'self'         -> blocks <base> tag hijacking of relative URLs
//   * object-src 'none'       -> blocks plugin/Flash injection
//   * form-action 'self'      -> forms can't be repointed to an attacker endpoint
// A full script-src/style-src policy is still deferred: it needs nonces tuned
// against Next.js + Supabase + analytics against the live app before enforcing.
const cspBaseDirectives = ["base-uri 'self'", "object-src 'none'", "form-action 'self'"];
// The app may only be framed by our OWN origin (never a third party), so
// clickjacking is still fully blocked while the in-app demo "phone view" preview
// can iframe the live app at phone width. 'self' is the standard SAMEORIGIN posture.
const cspFrameLocked = [...cspBaseDirectives, "frame-ancestors 'self'"].join("; ");
// The public application form is deliberately embeddable on customers' own sites
// (the "Embed" option builds an <iframe src=".../apply/<slug>?embed=1">), so it
// must be allowed to load inside a frame on any origin.
const cspEmbeddable = [...cspBaseDirectives, "frame-ancestors *"].join("; ");

// Baseline security headers applied to every response (framing handled below).
const commonSecurityHeaders = [
  // Force HTTPS for two years, including subdomains. Vercel already serves
  // everything over HTTPS, so this only hardens against downgrade attacks.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Stop browsers from MIME-sniffing a response into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin (not the full path) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny powerful browser features the app doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

// Everything EXCEPT the embeddable /apply form: framable only by our own origin
// (SAMEORIGIN) so a third party still can't frame the authenticated app, while the
// demo "phone view" preview can iframe it same-origin.
const lockedSecurityHeaders = [
  ...commonSecurityHeaders,
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: cspFrameLocked },
];

// The /apply form: same protections, but framable on any origin so restaurants
// can embed it on their own sites, and never indexed. Deliberately NO
// X-Frame-Options — the legacy header has no "allow any origin" value, so CSP
// frame-ancestors is what governs framing here.
const applyEmbedHeaders = [
  ...commonSecurityHeaders,
  { key: "Content-Security-Policy", value: cspEmbeddable },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// The free calculator's embed route (/calculator/embed): framable on any origin
// so consultants, affiliates, and partners can embed it on their own sites —
// every embed is a backlink. Framable CSP, no X-Frame-Options. The route sets
// its own noindex in metadata (it's a bare copy of the canonical /calculator),
// so no X-Robots-Tag here. The main /calculator page stays frame-locked +
// indexed like everything else.
const calcEmbedHeaders = [
  ...commonSecurityHeaders,
  { key: "Content-Security-Policy", value: cspEmbeddable },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in a response header (reduces fingerprinting).
  poweredByHeader: false,
  // Never emit browser source maps in production, so the client bundle can't be
  // trivially de-minified back to readable source. (This is Next.js's default;
  // pinning it makes the intent explicit and guards against a config drift.)
  productionBrowserSourceMaps: false,
  // The Global Payments Node SDK (Heartland/Portico billing) is a Node library —
  // keep it external so it's loaded from node_modules at runtime instead of being
  // bundled into the server output.
  serverExternalPackages: ["globalpayments-api"],
  experimental: {
    serverActions: {
      // Menu photo/PDF uploads (Role Training) and bulk social-post image
      // imports can exceed the 1MB default.
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    return [
      // The public application form is embeddable on customers' own sites (Hiring
      // → Embed builds an <iframe src=".../apply/<slug>?embed=1">), so it must
      // allow cross-origin framing and stay noindex (crawler-proof header layer on
      // top of the page's noindex <meta>). We do NOT robots.txt-disallow /apply —
      // that would stop Google from reading the noindex, which is counterproductive.
      { source: "/apply/:path*", headers: applyEmbedHeaders },
      // The embeddable calculator route (see calcEmbedHeaders).
      { source: "/calculator/embed", headers: calcEmbedHeaders },
      // Everything else is frame-locked. The negative lookahead excludes /apply
      // and /calculator/embed so the rules never apply conflicting frame headers
      // to the same request.
      { source: "/((?!apply/|calculator/embed).*)", headers: lockedSecurityHeaders },
      // The service worker must never be cached by the browser/CDN, so a new
      // deploy's sw.js is fetched immediately and the update flow can run.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
