import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getOrgOwnerEmails } from "@/lib/billing";
import { getLaunchPlanForOrg, LAUNCH_TOTAL_DAYS } from "@/lib/launch-plan";
import { buildLaunchEmail } from "@/lib/launch-email";

export const maxDuration = 60;

// Runs daily. Sends the weekly Launch Plan accountability nudge to owners who are
// still getting set up: at most once every 7 days per org, only while they're
// inside the launch window (+ a short grace), capped so we never nag, and never
// once they're fully launched. Each org's cadence is anchored to its own last
// send, so a Tuesday signup gets a Tuesday rhythm.
const WEEK_MS = 7 * 86400000;
const MAX_NUDGES = 5;
// Stop nudging well after the 14-day plan — no value in badgering a stalled org
// forever. ~6 weeks gives the grace to finish plus a couple of catch-up weeks.
const WINDOW_DAYS = LAUNCH_TOTAL_DAYS + 28;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_DAYS * 86400000).toISOString();

  // Only real orgs still inside the launch window. Demo orgs (shared master +
  // ephemeral sandboxes) are excluded — they're not customers to onboard.
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, created_at, system_generated, is_demo, launch_checkin_sent_at, launch_checkin_count")
    .or("is_demo.is.null,is_demo.eq.false")
    .gte("created_at", windowStart)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as {
      id: string;
      name: string;
      created_at: string;
      system_generated: boolean | null;
      launch_checkin_sent_at: string | null;
      launch_checkin_count: number | null;
    };
    try {
      // Weekly gate + nudge cap.
      const count = org.launch_checkin_count ?? 0;
      if (count >= MAX_NUDGES) {
        skipped++;
        continue;
      }
      if (org.launch_checkin_sent_at && now - new Date(org.launch_checkin_sent_at).getTime() < WEEK_MS) {
        skipped++;
        continue;
      }

      const plan = await getLaunchPlanForOrg(admin, org);
      // Fully launched — nothing to nudge. (Also skip the very first day so a
      // brand-new signup isn't emailed within hours of creating the account.)
      if (plan.allDone || plan.nextActions.length === 0 || plan.dayNumber < 2) {
        skipped++;
        continue;
      }

      const emails = await getOrgOwnerEmails(admin, org.id);
      if (emails.length === 0) {
        skipped++;
        continue;
      }

      const { subject, html } = buildLaunchEmail(plan, org.name);
      await sendEmail({ to: emails, subject, html, replyTo: "hello@joinwingman.app" });

      await admin
        .from("organizations")
        .update({ launch_checkin_sent_at: new Date(now).toISOString(), launch_checkin_count: count + 1 })
        .eq("id", org.id);
      sent++;
    } catch (err) {
      errors.push(`${org.id}:${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ scanned: orgs?.length ?? 0, sent, skipped, errors });
}
