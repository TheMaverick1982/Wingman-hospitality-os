import { NextResponse, type NextRequest } from "next/server";
import { getDemoPoolConfig, listDemoPoolMembers } from "@/lib/calendar/settings";
import { createDemoBooking } from "@/lib/calendar/book";
import { isValidTimeZone } from "@/lib/calendar/timezones";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Public: book a demo, round-robin, on the least-loaded free rep in the pool.
export async function POST(request: NextRequest) {
  const config = await getDemoPoolConfig();

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
  const tz = tzRaw && isValidTimeZone(tzRaw) ? tzRaw : config.time_zone;

  if (!Number.isFinite(startMs) || startMs <= 0) return NextResponse.json({ error: "Pick a time to continue." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a mobile number." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(`book:${ip}`, 10, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const members = await listDemoPoolMembers();
  if (members.length === 0) {
    return NextResponse.json({ error: "Demo booking isn't available right now." }, { status: 404 });
  }
  const result = await createDemoBooking({
    config,
    members,
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
