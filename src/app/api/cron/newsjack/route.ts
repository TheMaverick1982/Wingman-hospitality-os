import { NextResponse, type NextRequest } from "next/server";
import { runDailyNewsjack } from "@/lib/newsjack";

// Newsjack cron. Runs once a day: scans restaurant-industry news, drafts one
// timely Playbook post (grounded in the doctrine, with a sensitivity guardrail),
// saves it as a pending draft, and emails the platform admins to review + publish.
// Nothing publishes without a human approving it in Admin → Playbook.
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDailyNewsjack();
  return NextResponse.json({ ok: true, ...result });
}
