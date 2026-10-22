import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";
import { computePartnerReport, combinedReportHtml, locationReportHtml } from "@/lib/partner-report";

// Configurable Partners report. Runs daily; for each org with the report on it
// fires on the chosen cadence — weekly on the owner's chosen day, or monthly on
// the 1st (UTC). Delivery is either ONE combined email (all locations) or one
// email PER LOCATION, to the configured recipient list plus the owner(s). A
// per-org sent stamp prevents a double-send if the cron reruns.
export const maxDuration = 300;

const HOUR_MS = 3600000;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun..6=Sat
  const dom = now.getUTCDate();
  const todayMs = Date.now();

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, partners_report_frequency, partners_report_day, partners_report_mode, partners_report_emails, partners_report_sent_at, notification_settings, is_demo")
    .in("partners_report_frequency", ["weekly", "monthly"])
    .or("is_demo.is.null,is_demo.eq.false")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as {
      id: string; name: string; partners_report_frequency: "weekly" | "monthly"; partners_report_day: number;
      partners_report_mode: "combined" | "per_location"; partners_report_emails: string | null;
      partners_report_sent_at: string | null; notification_settings: Record<string, boolean> | null;
    };
    if (!isNotificationEnabled(org.notification_settings, "partner_monthly_report")) { skipped++; continue; }

    const weekly = org.partners_report_frequency === "weekly";
    if (weekly && dow !== (org.partners_report_day ?? 1)) { skipped++; continue; }
    if (!weekly && dom !== 1) { skipped++; continue; }

    // Dedupe: 3 days for weekly, 20 days for monthly.
    const windowMs = (weekly ? 72 : 480) * HOUR_MS;
    if (org.partners_report_sent_at && Date.now() - new Date(org.partners_report_sent_at).getTime() < windowMs) { skipped++; continue; }

    // Recipients: the configured list + the owner(s), so the owner always gets it.
    const listed = (org.partners_report_emails || "").split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
    const ownerEmails: string[] = [];
    try {
      const { data: owners } = await admin.from("profiles").select("id").eq("org_id", org.id).eq("access_role", "super_admin");
      for (const o of (owners ?? []) as { id: string }[]) {
        const { data: u } = await admin.auth.admin.getUserById(o.id);
        if (u?.user?.email) ownerEmails.push(u.user.email);
      }
    } catch { /* best-effort */ }
    const recipients = [...new Set([...listed, ...ownerEmails].map((e) => e.toLowerCase()))];
    if (recipients.length === 0) { skipped++; continue; }

    const periodLabel = weekly ? "This week" : "This month";
    const sinceIso = new Date(Date.now() - (weekly ? 7 : 31) * 24 * HOUR_MS).toISOString();
    const report = await computePartnerReport(admin, org.id, org.name, sinceIso, todayMs);
    if (report.locations.length === 0) { skipped++; continue; }

    try {
      if (org.partners_report_mode === "per_location") {
        for (const m of report.locations) {
          await sendEmail({
            to: recipients,
            subject: `${org.name} — Partners report: ${m.name} (${periodLabel.toLowerCase()})`,
            html: locationReportHtml(report, m, periodLabel),
          });
        }
      } else {
        await sendEmail({
          to: recipients,
          subject: `${org.name}: Partners report — ${periodLabel.toLowerCase()}`,
          html: combinedReportHtml(report, periodLabel),
        });
      }
      sent++;
      await admin.from("organizations").update({ partners_report_sent_at: new Date().toISOString() }).eq("id", org.id);
    } catch (e) {
      errors.push(`${org.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 20) });
}
