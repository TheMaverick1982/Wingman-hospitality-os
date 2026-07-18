import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { completeZoomOAuth } from "@/lib/calendar/zoom";

// Zoom OAuth callback. Verifies CSRF state, exchanges the code, and stores the
// connection so Outlook-hosted bookings can get a Zoom join link.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return NextResponse.redirect(new URL("/dashboard", request.url));

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/admin/calendar?z=denied", request.url));
  }

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("zoom_oauth_state")?.value;
  jar.delete("zoom_oauth_state");
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin/calendar?z=badstate", request.url));
  }

  const result = await completeZoomOAuth(code, profile.userId);
  if (result.error) {
    return NextResponse.redirect(new URL(`/admin/calendar?z=error&msg=${encodeURIComponent(result.error)}`, request.url));
  }
  return NextResponse.redirect(new URL("/admin/calendar?z=connected", request.url));
}
