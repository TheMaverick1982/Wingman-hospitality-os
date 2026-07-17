import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { completeGoogleOAuth } from "@/lib/calendar/google";
import { ensureUniqueSlug, getCalendarSettings, DEFAULT_AVAILABILITY } from "@/lib/calendar/settings";
import { createAdminClient } from "@/lib/supabase/admin";

// Google Calendar OAuth callback. Verifies CSRF state, exchanges the code, stores
// the connection, and seeds a booking-settings row on first connect so the rep
// lands on a ready-to-edit page.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return NextResponse.redirect(new URL("/dashboard", request.url));

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/admin/calendar?g=denied", request.url));
  }

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("google_oauth_state")?.value;
  jar.delete("google_oauth_state");
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin/calendar?g=badstate", request.url));
  }

  const result = await completeGoogleOAuth(code, profile.userId);
  if (result.error) {
    return NextResponse.redirect(new URL(`/admin/calendar?g=error&msg=${encodeURIComponent(result.error)}`, request.url));
  }

  // First connection: seed a booking-settings row (inactive until the rep
  // reviews availability and turns it on).
  const existing = await getCalendarSettings(profile.userId);
  if (!existing) {
    const slug = await ensureUniqueSlug(profile.fullName || "rep", profile.userId);
    const admin = createAdminClient();
    await admin.from("calendar_settings").insert({
      user_id: profile.userId,
      slug,
      time_zone: "America/New_York",
      availability: DEFAULT_AVAILABILITY,
      page_title: `Book a meeting with ${profile.fullName || "our team"}`,
      is_active: false,
    });
  }

  return NextResponse.redirect(new URL("/admin/calendar?g=connected", request.url));
}
