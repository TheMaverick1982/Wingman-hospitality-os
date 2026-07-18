import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { completeMicrosoftOAuth } from "@/lib/calendar/microsoft";
import { seedCalendarSettingsIfMissing } from "@/lib/calendar/settings";

// Outlook / Microsoft 365 OAuth callback. Verifies CSRF state, exchanges the
// code, stores the connection, and seeds a booking-settings row on first connect.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return NextResponse.redirect(new URL("/dashboard", request.url));

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/admin/calendar?m=denied", request.url));
  }

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("microsoft_oauth_state")?.value;
  jar.delete("microsoft_oauth_state");
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin/calendar?m=badstate", request.url));
  }

  const result = await completeMicrosoftOAuth(code, profile.userId);
  if (result.error) {
    return NextResponse.redirect(new URL(`/admin/calendar?m=error&msg=${encodeURIComponent(result.error)}`, request.url));
  }

  await seedCalendarSettingsIfMissing(profile.userId, profile.fullName);
  return NextResponse.redirect(new URL("/admin/calendar?m=connected", request.url));
}
