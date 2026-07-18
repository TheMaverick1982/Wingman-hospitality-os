import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { microsoftAuthUrl, microsoftCalendarConfigured } from "@/lib/calendar/microsoft";

// Start the Outlook / Microsoft 365 OAuth flow for the signed-in salesperson.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!microsoftCalendarConfigured()) {
    return NextResponse.redirect(new URL("/admin/calendar?m=unconfigured", request.url));
  }
  const state = randomUUID();
  const jar = await cookies();
  jar.set("microsoft_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(microsoftAuthUrl(state));
}
