import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/calendar/reminders";

// Hourly: send the pre-appointment reminder series (day-before + starting-soon)
// for confirmed bookings. Idempotent — reminders_sent guards against re-sending.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueReminders();
  return NextResponse.json({ ok: true, ...result });
}
