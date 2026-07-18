import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "./booking-email";
import { formatDateLong, formatTime } from "./availability";
import { twilioConfigured, sendSms } from "./sms";
import { siteUrl } from "./google";

// Pre-appointment reminder series. Run hourly by cron: a "day before" nudge and a
// "starting soon" nudge, each sent at most once per booking per channel (tracked
// in reminders_sent: '24h'/'1h' for email, 'sms24h'/'sms1h' for SMS).
type ReminderRow = {
  id: string;
  user_id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_phone: string;
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
    .select("id, user_id, invitee_name, invitee_email, invitee_phone, start_at, end_at, time_zone, meet_link, manage_token, reminders_sent")
    .eq("status", "confirmed")
    .gte("start_at", new Date(nowMs).toISOString())
    .lte("start_at", new Date(nowMs + 25 * 3_600_000).toISOString());

  const rows = (data ?? []) as ReminderRow[];
  const hostNames = new Map<string, string>();
  const smsOn = twilioConfigured();
  let sent = 0;

  for (const row of rows) {
    const startMs = new Date(row.start_at).getTime();
    const endMs = new Date(row.end_at).getTime();
    const hoursUntil = (startMs - nowMs) / 3_600_000;
    const already = new Set(row.reminders_sent ?? []);

    // Which lead window are we in?
    const lead: "24h" | "1h" | null = hoursUntil <= 1 ? "1h" : hoursUntil <= 24 ? "24h" : null;
    if (!lead) continue;

    const emailKey = lead; // '24h' | '1h'
    const smsKey = `sms${lead}`; // 'sms24h' | 'sms1h'
    const needEmail = Boolean(row.invitee_email) && !already.has(emailKey);
    const needSms = smsOn && Boolean(row.invitee_phone) && !already.has(smsKey);
    if (!needEmail && !needSms) continue;

    // Resolve host name (cached across rows).
    let hostName = hostNames.get(row.user_id);
    if (hostName === undefined) {
      const { data: host } = await admin.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle();
      hostName = (host as { full_name?: string } | null)?.full_name || "the Wingman team";
      hostNames.set(row.user_id, hostName);
    }

    const tz = row.time_zone || "America/New_York";
    const added: string[] = [];

    if (needEmail) {
      try {
        const email = buildReminderEmail({
          inviteeName: row.invitee_name,
          hostName,
          startMs,
          endMs,
          timeZone: tz,
          meetLink: row.meet_link,
          lead,
          manageUrl: row.manage_token ? `${siteUrl()}/booking/${row.manage_token}` : undefined,
        });
        await sendEmail({ to: [row.invitee_email], subject: email.subject, html: email.html });
        added.push(emailKey);
        sent++;
      } catch {
        // skip; a later run retries
      }
    }

    if (needSms) {
      try {
        const soon = lead === "1h";
        const when = soon ? `at ${formatTime(startMs, tz)}` : `${formatDateLong(startMs, tz)} at ${formatTime(startMs, tz)}`;
        const link = row.meet_link ? ` Join: ${row.meet_link}` : "";
        const body = soon
          ? `Reminder: your meeting with ${hostName} starts soon (${when}).${link} — Wingman`
          : `Reminder: your meeting with ${hostName} is ${when}.${link} — Wingman`;
        const res = await sendSms(row.invitee_phone, body);
        if (res.ok) {
          added.push(smsKey);
          sent++;
        }
      } catch {
        // skip; a later run retries
      }
    }

    if (added.length) {
      await admin
        .from("calendar_bookings")
        .update({ reminders_sent: [...already, ...added] })
        .eq("id", row.id);
    }
  }

  return { scanned: rows.length, sent };
}
