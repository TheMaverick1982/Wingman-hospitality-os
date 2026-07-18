import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { zoomAuthUrl, zoomConfigured } from "@/lib/calendar/zoom";

// Start the Zoom OAuth flow for the signed-in salesperson (adds a video provider).
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!zoomConfigured()) {
    return NextResponse.redirect(new URL("/admin/calendar?z=unconfigured", request.url));
  }
  const state = randomUUID();
  const jar = await cookies();
  jar.set("zoom_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(zoomAuthUrl(state));
}
