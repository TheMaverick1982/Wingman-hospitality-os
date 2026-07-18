import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarSettingsBySlug } from "@/lib/calendar/settings";
import { createBooking } from "@/lib/calendar/book";
import { isValidTimeZone } from "@/lib/calendar/timezones";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Public: create a booking on a rep's calendar. Validates input, rate-limits by
// IP, then delegates to createBooking (which re-checks availability, makes the
// Google event + Meet link, and emails the .ics confirmation).
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await getCalendarSettingsBySlug(slug);
  if (!settings || !settings.is_active) {
    return NextResponse.json({ error: "This booking page isn't available." }, { status: 404 });
  }

  let body: { start?: unknown; name?: unknown; email?: unknown; phone?: unknown; notes?: unknown; tz?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const startMs = Number(body.start);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const tzRaw = typeof body.tz === "string" ? body.tz : "";
  const tz = tzRaw && isValidTimeZone(tzRaw) ? tzRaw : settings.time_zone;

  if (!Number.isFinite(startMs) || startMs <= 0) {
    return NextResponse.json({ error: "Pick a time to continue." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Enter a mobile number." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ok = await consumeRateLimit(`book:${ip}`, 10, 3600); // 10 bookings / IP / hour
  if (!ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  // Host display name (for the invite/email) — read minimally.
  const admin = createAdminClient();
  const { data: host } = await admin.from("profiles").select("full_name").eq("id", settings.user_id).maybeSingle();
  const hostName = (host as { full_name?: string } | null)?.full_name || "our team";

  const result = await createBooking({
    settings,
    hostName,
    startMs,
    inviteeName: name,
    inviteeEmail: email,
    invitePhone: phone,
    notes,
    displayTimeZone: tz,
    nowMs: Date.now(),
  });

  if (!result.ok) {
    const status = result.code === "slot_taken" ? 409 : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, meetLink: result.meetLink });
}
