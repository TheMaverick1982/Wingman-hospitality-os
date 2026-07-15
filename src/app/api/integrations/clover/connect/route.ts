import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { cloverConfigured, cloverAuthorizeUrl } from "@/lib/clover";

// Owner starts the Clover OAuth flow. Short-lived state cookie for CSRF, then
// redirect to Clover's consent screen.
export async function GET() {
  const profile = await getCurrentProfile();
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  if (!profile || profile.accessRole !== "super_admin") {
    return NextResponse.redirect(`${base}/settings`);
  }
  if (!cloverConfigured()) {
    return NextResponse.redirect(`${base}/settings?tab=api&clover=unconfigured`);
  }

  const state = randomUUID();
  const jar = await cookies();
  jar.set("clover_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(cloverAuthorizeUrl(state));
}
