import { NextResponse, type NextRequest } from "next/server";
import { cancelBookingByToken } from "@/lib/calendar/book";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

// Public: cancel a booking via its opaque manage token (no login). Deletes the
// Google event and emails the guest a rebook link.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(`cancel:${ip}`, 20, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const result = await cancelBookingByToken(token);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Couldn't cancel." }, { status: 400 });
  return NextResponse.json({ ok: true, rebookPath: result.rebookPath });
}
