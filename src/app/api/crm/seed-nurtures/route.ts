import { NextResponse, type NextRequest } from "next/server";
import { seedNurtureSequences } from "@/lib/crm-seed";

// Idempotent seeder for the spec nurture sequences (demo / calculator / scorecard).
// Rewrites each sequence's steps to the authoritative spec copy + cadence, always
// leaving them in DRAFT (published=false). Retires the legacy sales-chat sequence.
// Guarded by CRON_SECRET (Bearer). There's also a one-click "Resync spec copy"
// button in Admin → CRM → Automations that does the same thing behind admin auth.
//
//   curl -X POST https://www.joinwingman.app/api/crm/seed-nurtures \
//        -H "authorization: Bearer $CRON_SECRET"
//
// Add ?force=1 to overwrite a sequence you've already published.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  const seeded = await seedNurtureSequences(force);
  return NextResponse.json({ ok: true, seeded });
}
