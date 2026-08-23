import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { gbpAuthUrl, gbpConfigured } from "@/lib/google-business";

// Start the Google Business Profile OAuth flow so an owner/manager can connect
// their Google account and pull each location's reviews. Sets a CSRF state cookie
// and redirects to Google's consent screen.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return NextResponse.redirect(new URL("/reviews", request.url));
  }
  if (!gbpConfigured()) {
    return NextResponse.redirect(new URL("/reviews?g=unconfigured", request.url));
  }
  const state = randomUUID();
  const jar = await cookies();
  jar.set("gbp_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(gbpAuthUrl(state));
}
