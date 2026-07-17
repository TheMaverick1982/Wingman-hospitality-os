import { NextResponse, type NextRequest } from "next/server";
import { getCalendarSettingsBySlug } from "@/lib/calendar/settings";
import { getAvailableSlots, serializeSlots } from "@/lib/calendar/book";
import { isValidTimeZone } from "@/lib/calendar/timezones";

// Public: available slots for a rep's booking page. `tz` (IANA) formats the slot
// labels in the invitee's zone; the underlying instants are timezone-agnostic
// epoch ms so the client can re-group by date however it likes.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await getCalendarSettingsBySlug(slug);
  if (!settings || !settings.is_active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const tzParam = request.nextUrl.searchParams.get("tz") ?? "";
  const tz = tzParam && isValidTimeZone(tzParam) ? tzParam : settings.time_zone;

  const slots = await getAvailableSlots(settings, Date.now());
  return NextResponse.json({
    timeZone: tz,
    durationMinutes: settings.meeting_duration_minutes,
    slots: serializeSlots(slots, tz),
  });
}
