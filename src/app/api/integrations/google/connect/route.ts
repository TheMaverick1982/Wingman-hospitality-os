import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { googleAuthUrl, googleCalendarConfigured } from "@/lib/calendar/google";

// Start the Google Calendar OAuth flow for the signed-in salesperson (any
// platform staffer manages their own calendar). Sets a CSRF state cookie and
// redirects to Google's consent screen.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/admin/calendar?g=unconfigured", request.url));
  }
  const state = randomUUID();
  const jar = await cookies();
  jar.set("google_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(googleAuthUrl(state));
}
