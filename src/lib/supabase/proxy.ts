import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  // Forgot-password is used by people who are NOT logged in, so it must be
  // reachable without a session (otherwise the middleware bounces them to
  // /login and the link looks dead).
  "/forgot-password",
  "/how-it-works",
  "/guest-journey",
  "/pricing",
  "/book-a-demo",
  // The Playbook — public SEO content hub (visitors are logged out).
  "/playbook",
  // Self-serve "Try the live demo" — provisions a throwaway sandbox for a
  // visitor who is (by definition) not yet logged in.
  "/demo",
  // Public pre-sales chat API — called by logged-out marketing visitors, so it
  // must not be bounced to /login (the route does its own IP/rate limiting).
  "/api/sales-chat",
  // Per-salesperson booking pages + their availability/booking APIs — the
  // prospect self-booking a meeting is (by definition) not logged in.
  "/book",
  "/api/book",
  // Machine-to-machine / no-session API routes that authenticate themselves and
  // must never be redirected to the HTML login page:
  //   /api/webhooks       — inbound webhooks (e.g. GHL booking) guarded by a token
  //   /api/crm/unsubscribe — one-click email unsubscribe (HMAC-signed link)
  //   /api/cron           — scheduled jobs guarded by CRON_SECRET (Vercel cron)
  "/api/webhooks",
  "/api/crm",
  "/api/cron",
  // First-party page-view beacon from the public marketing site (no auth).
  "/api/track",
  "/privacy",
  "/terms",
  // PWA offline fallback page — precached by the service worker, must be auth-free.
  "/offline",
  // "Get the app" / install-to-home-screen page — public (visitors install before
  // signing in), so it must not bounce to /login.
  "/download",
  // Public contact page + its form action (SMS opt-in capture).
  "/contact",
  // Public account/data deletion request page — required by Google Play / Apple
  // to be reachable without a login (reviewers and users open it logged out).
  "/delete-account",
  "/api-guide",
  // Affiliate program: public marketing + apply + login. The dashboard lives
  // under /affiliates/dashboard and is gated in its own layout (redirects
  // non-affiliates to /affiliates/login).
  "/affiliates",
  // Referral link entry point (/r/<code>) — visitors aren't logged in.
  "/r",
  // Public lead-magnet tools.
  "/calculator",
  "/scorecard",
  // Link-in-bio page for social profiles.
  "/links",
  // Launch-special funnel (unlinked landing page).
  "/launch",
  // Founders funnel (unindexed, unlinked landing page).
  "/founders",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath =
    request.nextUrl.pathname === "/" ||
    PUBLIC_PREFIXES.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
