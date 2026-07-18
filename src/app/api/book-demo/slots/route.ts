import { NextResponse, type NextRequest } from "next/server";
import { getDemoPoolConfig, listDemoPoolMembers } from "@/lib/calendar/settings";
import { getDemoPoolSlots, serializeSlots } from "@/lib/calendar/book";
import { isValidTimeZone } from "@/lib/calendar/timezones";

// Public: available slots for the round-robin /book-a-demo page — times where at
// least one pooled rep is free.
export async function GET(request: NextRequest) {
  const [config, members] = await Promise.all([getDemoPoolConfig(), listDemoPoolMembers()]);
  if (members.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const tzParam = request.nextUrl.searchParams.get("tz") ?? "";
  const tz = tzParam && isValidTimeZone(tzParam) ? tzParam : config.time_zone;

  const slots = await getDemoPoolSlots(config, members, Date.now());
  return NextResponse.json({
    timeZone: tz,
    durationMinutes: config.meeting_duration_minutes,
    slots: serializeSlots(slots, tz),
  });
}
