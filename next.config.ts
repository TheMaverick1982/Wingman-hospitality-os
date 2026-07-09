import type { NextConfig } from "next";

// A deliberately PARTIAL Content-Security-Policy. It sets only the directives
// that are safe to enforce without an allowlist audit of every script/style/
// analytics origin -- so it cannot white-screen the live app -- while still
// closing real attack classes:
//   * frame-ancestors 'none'  -> clickjacking (modern replacement for X-Frame-Options)
//   * base-uri 'self'         -> blocks <base> tag hijacking of relative URLs
//   * object-src 'none'       -> blocks plugin/Flash injection
//   * form-action 'self'      -> forms can't be repointed to an attacker endpoint
// A full script-src/style-src policy is still deferred: it needs nonces tuned
// against Next.js + Supabase + analytics against the live app before enforcing.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

// Baseline security headers applied to every response.
const securityHeaders = [
  // Force HTTPS for two years, including subdomains. Vercel already serves
  // everything over HTTPS, so this only hardens against downgrade attacks.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Stop browsers from MIME-sniffing a response into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't allow the app (including authenticated dashboards) to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin (not the full path) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny powerful browser features the app doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Safe subset of CSP (see note above).
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in a response header (reduces fingerprinting).
  poweredByHeader: false,
  // Never emit browser source maps in production, so the client bundle can't be
  // trivially de-minified back to readable source. (This is Next.js's default;
  // pinning it makes the intent explicit and guards against a config drift.)
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      // Menu photo/PDF uploads (Role Training) can exceed the 1MB default.
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
