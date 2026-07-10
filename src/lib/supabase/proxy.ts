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
  "/pricing",
  "/book-a-demo",
  "/privacy",
  "/terms",
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
