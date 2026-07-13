import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getOrgOwnerEmails } from "@/lib/billing";
import { getMomentumForOrg } from "@/lib/momentum";
import { buildMomentumNudgeEmail } from "@/lib/momentum-email";

export const maxDuration = 60;

// Runs daily. Re-engages set-up orgs whose usage has stalled (below the active
// bar this week): at most once every 7 days per org, capped so we never harass,
// and only for real, non-canceled accounts that are past their launch window
// (so this doesn't double up with the launch-checkin nudges). Owners in the
// dunning/past-due flow are left alone.
const WEEK_MS = 7 * 86400000;
const MAX_NUDGES = 8;
// Only start once the 14-day launch (+ buffer) is behind them — before that,
// launch-checkin owns the nudging.
const POST_LAUNCH_DAYS = 21;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const launchedBefore = new Date(now - POST_LAUNCH_DAYS * 86400000).toISOString();

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, created_at, billing_status, is_demo, momentum_nudge_sent_at, momentum_nudge_count")
    .or("is_demo.is.null,is_demo.eq.false")
    .in("billing_status", ["active", "free"]) // skip canceled + past_due (dunning owns those)
    .lte("created_at", launchedBefore)
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as {
      id: string;
      name: string;
      momentum_nudge_sent_at: string | null;
      momentum_nudge_count: number | null;
    };
    try {
      const count = org.momentum_nudge_count ?? 0;
      if (count >= MAX_NUDGES) {
        skipped++;
        continue;
      }
      if (org.momentum_nudge_sent_at && now - new Date(org.momentum_nudge_sent_at).getTime() < WEEK_MS) {
        skipped++;
        continue;
      }

      const momentum = await getMomentumForOrg(admin, org.id);
      if (!momentum.stalled) {
        skipped++;
        continue; // they're running the plays — no nudge, and no counter bump
      }

      const emails = await getOrgOwnerEmails(admin, org.id);
      if (emails.length === 0) {
        skipped++;
        continue;
      }

      const { subject, html } = buildMomentumNudgeEmail(momentum, org.name);
      await sendEmail({ to: emails, subject, html, replyTo: "hello@joinwingman.app" });

      await admin
        .from("organizations")
        .update({ momentum_nudge_sent_at: new Date(now).toISOString(), momentum_nudge_count: count + 1 })
        .eq("id", org.id);
      sent++;
    } catch (err) {
      errors.push(`${org.id}:${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ scanned: orgs?.length ?? 0, sent, skipped, errors });
}
