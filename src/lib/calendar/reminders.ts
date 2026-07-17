import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "./booking-email";
import { siteUrl } from "./google";

// Pre-appointment reminder series. Run hourly by cron: a "day before" nudge and a
// "starting soon" nudge, each sent at most once per booking (tracked in
// reminders_sent so a re-run never double-sends).
type ReminderRow = {
  id: string;
  user_id: string;
  invitee_name: string;
  invitee_email: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  meet_link: string;
  manage_token: string;
  reminders_sent: string[] | null;
};

export async function sendDueReminders(nowMs = Date.now()): Promise<{ scanned: number; sent: number }> {
  const admin = createAdminClient();
  // Only look at confirmed bookings starting within the next ~25h.
  const { data } = await admin
    .from("calendar_bookings")
    .select("id, user_id, invitee_name, invitee_email, start_at, end_at, time_zone, meet_link, manage_token, reminders_sent")
    .eq("status", "confirmed")
    .gte("start_at", new Date(nowMs).toISOString())
    .lte("start_at", new Date(nowMs + 25 * 3_600_000).toISOString());

  const rows = (data ?? []) as ReminderRow[];
  const hostNames = new Map<string, string>();
  let sent = 0;

  for (const row of rows) {
    if (!row.invitee_email) continue;
    const startMs = new Date(row.start_at).getTime();
    const endMs = new Date(row.end_at).getTime();
    const hoursUntil = (startMs - nowMs) / 3_600_000;
    const already = new Set(row.reminders_sent ?? []);

    let lead: "24h" | "1h" | null = null;
    if (hoursUntil <= 1 && !already.has("1h")) lead = "1h";
    else if (hoursUntil <= 24 && hoursUntil > 1 && !already.has("24h")) lead = "24h";
    if (!lead) continue;

    // Resolve host name (cached across rows).
    let hostName = hostNames.get(row.user_id);
    if (hostName === undefined) {
      const { data: host } = await admin.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle();
      hostName = (host as { full_name?: string } | null)?.full_name || "the Wingman team";
      hostNames.set(row.user_id, hostName);
    }

    try {
      const email = buildReminderEmail({
        inviteeName: row.invitee_name,
        hostName,
        startMs,
        endMs,
        timeZone: row.time_zone || "America/New_York",
        meetLink: row.meet_link,
        lead,
        manageUrl: row.manage_token ? `${siteUrl()}/booking/${row.manage_token}` : undefined,
      });
      await sendEmail({ to: [row.invitee_email], subject: email.subject, html: email.html });
      await admin
        .from("calendar_bookings")
        .update({ reminders_sent: [...already, lead] })
        .eq("id", row.id);
      sent++;
    } catch {
      // skip; a later run retries
    }
  }

  return { scanned: rows.length, sent };
}
