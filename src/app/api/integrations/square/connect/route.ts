import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { squareConfigured, squareAuthorizeUrl } from "@/lib/square";

// Owner starts the Square OAuth flow. We set a short-lived state cookie for CSRF
// and redirect to Square's consent screen.
export async function GET() {
  const profile = await getCurrentProfile();
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  if (!profile || profile.accessRole !== "super_admin") {
    return NextResponse.redirect(`${base}/settings`);
  }
  if (!squareConfigured()) {
    return NextResponse.redirect(`${base}/settings?square=unconfigured`);
  }

  const state = randomUUID();
  const jar = await cookies();
  jar.set("square_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(squareAuthorizeUrl(state));
}
