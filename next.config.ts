import type { NextConfig } from "next";

// Baseline security headers applied to every response. These are the safe,
// no-config-needed protections; a Content-Security-Policy is intentionally
// left out for now because a strict CSP needs to be tuned against the live
// app (inline scripts/styles, Supabase, analytics) before it can be enforced
// without breaking pages.
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
];

const nextConfig: NextConfig = {
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
