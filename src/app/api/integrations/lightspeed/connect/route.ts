import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { lightspeedConfigured, lightspeedAuthorizeUrl, lightspeedRedirectUrl, LIGHTSPEED_ENV, LIGHTSPEED_OAUTH_BASE } from "@/lib/lightspeed";

// Owner starts the Lightspeed OAuth flow. Short-lived state cookie for CSRF, then
// redirect to Lightspeed's consent screen. ?check=1 returns the authorize URL +
// config as JSON instead of redirecting (self-diagnostic).
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  if (!profile || profile.accessRole !== "super_admin") {
    return NextResponse.redirect(`${base}/settings`);
  }
  if (!lightspeedConfigured()) {
    return NextResponse.redirect(`${base}/settings?tab=api&lightspeed=unconfigured`);
  }

  const state = randomUUID();
  const authorizeUrl = lightspeedAuthorizeUrl(state);

  if (request.nextUrl.searchParams.get("check")) {
    return NextResponse.json({
      env: LIGHTSPEED_ENV,
      oauthBase: LIGHTSPEED_OAUTH_BASE,
      redirectUri: lightspeedRedirectUrl(),
      authorizeUrl,
    });
  }

  const jar = await cookies();
  jar.set("lightspeed_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(authorizeUrl);
}
