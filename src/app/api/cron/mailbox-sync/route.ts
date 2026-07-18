import { NextResponse, type NextRequest } from "next/server";
import { syncMicrosoftInbound } from "@/lib/mailbox";

// Pulls replies from connected mailboxes into Conversations (email_in). Microsoft
// 365 today; Google is reply-routed via the inbound webhook, not polled.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncMicrosoftInbound();
  return NextResponse.json({ ok: true, ...result });
}
