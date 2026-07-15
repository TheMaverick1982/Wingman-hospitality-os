import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { cloverConfigured, cloverAuthorizeUrl, cloverRedirectUrl, CLOVER_ENV, CLOVER_OAUTH_BASE } from "@/lib/clover";

// Owner starts the Clover OAuth flow. Short-lived state cookie for CSRF, then
// redirect to Clover's consent screen.
//
// ?check=1 returns the exact authorize URL + config as JSON instead of
// redirecting — a self-diagnostic so we can verify the client_id (O vs 0),
// redirect_uri (www?), and environment without reading server logs.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  if (!profile || profile.accessRole !== "super_admin") {
    return NextResponse.redirect(`${base}/settings`);
  }
  if (!cloverConfigured()) {
    return NextResponse.redirect(`${base}/settings?tab=api&clover=unconfigured`);
  }

  const state = randomUUID();
  const authorizeUrl = cloverAuthorizeUrl(state);

  if (request.nextUrl.searchParams.get("check")) {
    return NextResponse.json({
      env: CLOVER_ENV,
      oauthBase: CLOVER_OAUTH_BASE,
      redirectUri: cloverRedirectUrl(),
      authorizeUrl,
    });
  }

  const jar = await cookies();
  jar.set("clover_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(authorizeUrl);
}
