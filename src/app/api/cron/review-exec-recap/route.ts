import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { composeReviewSummary } from "@/lib/review-summary";
import { execRecapEmailHtml } from "@/lib/review-email";

export const maxDuration = 300;

// Runs daily. Emails ownership a COMPANY-WIDE (all-locations) guest-feedback
// recap on the cadence the owner picked — daily (every day) or weekly (Mondays)
// — to the specific ownership addresses set on the Reviews page. Separate from
// the per-location review digest: one email per org, all locations combined,
// with supporting quotes and (optionally) the "This week" action. A per-org sent
// stamp prevents a double-send if the cron reruns.
const HOUR_MS = 3600000;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, review_exec_frequency, review_exec_emails, review_exec_include_actions, review_exec_sent_at, is_demo")
    .in("review_exec_frequency", ["daily", "weekly"])
    .or("is_demo.is.null,is_demo.eq.false")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as { id: string; name: string; review_exec_frequency: string; review_exec_emails: string | null; review_exec_include_actions: boolean; review_exec_sent_at: string | null };
    const daily = org.review_exec_frequency === "daily";
    if (!daily && !isMonday) { skipped++; continue; }

    // Dedupe window: ~20h for daily (one per day), 3 days for weekly.
    const windowMs = daily ? 20 * HOUR_MS : 72 * HOUR_MS;
    if (org.review_exec_sent_at && Date.now() - new Date(org.review_exec_sent_at).getTime() < windowMs) { skipped++; continue; }

    const recipients = (org.review_exec_emails || "").split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
    if (recipients.length === 0) { skipped++; continue; }

    // Broken down BY LOCATION, stacked into one email. Quotes on; the "This week"
    // action follows the owner's toggle. Only the trailing period (daily = last
    // day, weekly = last 7 days) so each recap covers NEW feedback and never
    // re-reports old reviews. A location with no new feedback this period is
    // simply left out.
    const sinceIso = new Date(Date.now() - (daily ? 1 : 7) * 24 * HOUR_MS).toISOString();
    const periodLabel = daily ? "the last day" : "the last week";
    const includeActions = org.review_exec_include_actions !== false;
    const { data: locs } = await admin.from("locations").select("id, name").eq("org_id", org.id).order("name");
    const locations = (locs ?? []) as { id: string; name: string }[];
    const sections: { locationName: string; summary: string }[] = [];
    for (const loc of locations) {
      const r = await composeReviewSummary(admin, {
        orgId: org.id,
        orgName: org.name,
        scopeLocationId: loc.id,
        includeActions,
        includeQuotes: true,
        sinceIso,
        periodLabel,
      });
      if (!r.error && r.summary) sections.push({ locationName: loc.name, summary: r.summary });
    }
    if (sections.length === 0) { skipped++; continue; } // no NEW feedback at any location this period

    const period = daily ? "Today" : "This week";
    const html = execRecapEmailHtml({
      orgName: org.name,
      periodTitle: `${period}'s ownership recap`,
      subLine: `Company-wide guest feedback, broken down by location.`,
      sections,
      footer: `You're getting this because the ownership recap is on for ${org.name}. An owner can change the cadence or recipients under Guests → Reviews.`,
    });

    try {
      await sendEmail({ to: recipients, subject: `${period}'s ownership recap — ${org.name}`, html });
      sent++;
      await admin.from("organizations").update({ review_exec_sent_at: new Date().toISOString() }).eq("id", org.id);
    } catch (e) {
      errors.push(`${org.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 20) });
}
