import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  // Public job-application form (/apply/<org-slug>, incl. ?embed=1). Applicants
  // and embedded iframes have no session, so this MUST be reachable logged-out —
  // otherwise the middleware bounces them to /login (which is frame-locked, so an
  // embed just shows "refused to connect").
  "/apply",
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
  // Job-opening short links (/j/<code> and /j/<code>/qr) — a public apply link
  // and its QR image; the visitor is a job applicant, not logged in.
  "/j",
  // Public lead-magnet tools.
  "/calculator",
  "/scorecard",
  // Link-in-bio page for social profiles.
  "/links",
  // Launch-special funnel (unlinked landing page).
  "/launch",
  // Founders funnel (unindexed, unlinked landing page).
  "/founders",
  // Retention Guarantee offer (unindexed, unlinked landing page).
  "/guarantee",
];

// The native apps (iOS + Android) are login-only clients for existing business
// customers. Every marketing, account/organization registration, pricing, or
// external-purchase / lead-capture surface must be kept OUT of the app (App
// Store guideline 3.1.1; business model established under 2.1(b)). In the app
// these all redirect to /login; the authenticated product (dashboard, hiring,
// training, settings, …) is untouched, and account creation + billing happen on
// the web only.
//
// How we know a request is a native app (either is sufficient):
//   1. The "WingmanNative" user-agent marker appended by Capacitor
//      (capacitor.config.json → ios.appendUserAgent = "WingmanNativeIOS",
//      android.appendUserAgent = "WingmanNativeAndroid"). Matching the shared
//      "WingmanNative" prefix covers both platforms.
//   2. A durable cookie stamped on first launch via NATIVE_APP_ENTRY — a
//      secondary fallback for the case where the UA marker doesn't reach us.
// Both are things only the app ever presents, so this is a no-op for the website.
const NATIVE_UA_MARKER = "WingmanNative";
const NATIVE_APP_COOKIE = "wm_native";
const NATIVE_APP_ENTRY = "/app-entry";

function isNativeApp(request: NextRequest): boolean {
  if (request.cookies.get(NATIVE_APP_COOKIE)?.value === "ios") return true;
  return (request.headers.get("user-agent") ?? "").includes(NATIVE_UA_MARKER);
}

const IOS_BLOCKED_PREFIXES = [
  "/signup",
  "/onboarding",
  "/demo",
  "/pricing",
  "/how-it-works",
  "/guest-journey",
  "/book-a-demo",
  "/book",
  "/playbook",
  "/affiliates",
  "/r",
  "/calculator",
  "/scorecard",
  "/links",
  "/launch",
  "/founders",
  "/guarantee",
  "/download",
  "/api-guide",
  "/contact",
];

function isBlockedInNativeIOS(request: NextRequest): boolean {
  if (!isNativeApp(request)) return false;
  const p = request.nextUrl.pathname;
  // The marketing homepage is the app's entry point, so it must redirect too.
  if (p === "/") return true;
  return IOS_BLOCKED_PREFIXES.some((path) => p === path || p.startsWith(path + "/"));
}

export async function updateSession(request: NextRequest) {
  // The native iOS app boots into this app-only URL (capacitor server.url).
  // Stamp the durable native cookie, then hand off to the login-only experience.
  // Doing it here means the very first request the app makes marks it as native,
  // independent of whether the webview user-agent token survives.
  if (request.nextUrl.pathname === NATIVE_APP_ENTRY) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    res.cookies.set(NATIVE_APP_COOKIE, "ios", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 5,
    });
    return res;
  }

  let response = NextResponse.next({ request });

  // Keep registration/marketing/pricing out of the native iOS app before doing
  // anything else. Redirecting to /login (which forwards signed-in users on to
  // their dashboard) leaves a clean login-only experience for App Review.
  if (isBlockedInNativeIOS(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
