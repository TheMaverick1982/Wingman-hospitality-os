import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  computeSlots,
  intervalIsFree,
  toRfc3339WithOffset,
  formatDateLong,
  formatDayKey,
  formatTime,
  type Slot,
} from "./availability";
import { siteUrl, type GoogleAccountRow } from "./google";
import type { MicrosoftAccountRow } from "./microsoft";
import { getZoomAccount, createZoomMeeting } from "./zoom";
import { twilioConfigured, sendSms } from "./sms";
import { listCalendarAccounts, mergedFreeBusyAll, createEventOn, deleteEventOn, type CalendarAccount } from "./providers";
import { buildIcs } from "./ics";
import { buildBookingEmail, buildCancellationEmail } from "./booking-email";
import { type CalendarSettings, type DemoPoolConfig, type VideoProvider } from "./settings";

// Compute bookable slots for a single rep: their weekly rules minus busy time
// merged across every connected calendar (Google and/or Outlook).
export async function getAvailableSlots(settings: CalendarSettings, nowMs: number): Promise<Slot[]> {
  const accounts = await listCalendarAccounts(settings.user_id);
  const busy = accounts.length ? await mergedFreeBusyAll(accounts, nowMs, nowMs + settings.booking_window_days * 86_400_000) : [];
  return computeSlots({
    rules: settings.availability,
    timeZone: settings.time_zone,
    durationMinutes: settings.meeting_duration_minutes,
    bufferMinutes: settings.buffer_minutes,
    advanceNoticeHours: settings.advance_notice_hours,
    windowDays: settings.booking_window_days,
    nowMs,
    busy,
  });
}

export type BookResult = { ok: true; meetLink: string; startMs: number } | { ok: false; error: string; code?: string };

// Shared finalizer: create the Google event with a Meet link, persist the booking
// row, and email the invitee a confirmation with an .ics. Used by both the single-
// rep flow and the round-robin demo pool.
async function finalizeBooking(opts: {
  userId: string;
  accounts: CalendarAccount[];
  videoProvider: VideoProvider;
  hostName: string;
  summary: string;
  timeZone: string; // host time zone for the calendar event
  displayTimeZone: string; // invitee's zone for their confirmation
  startMs: number;
  endMs: number;
  inviteeName: string;
  inviteeEmail: string;
  invitePhone: string;
  notes: string;
  rebookPath: string;
  nowMs: number;
}): Promise<BookResult> {
  const startISO = toRfc3339WithOffset(opts.startMs, opts.timeZone);
  const endISO = toRfc3339WithOffset(opts.endMs, opts.timeZone);
  const description = [`Booked via Wingman.`, opts.notes ? `\nNote from ${opts.inviteeName || "guest"}:\n${opts.notes}` : ""].join("");
  const manageToken = randomUUID();
  const manageUrl = `${siteUrl()}/booking/${manageToken}`;

  // Pick the host calendar. For a Google Meet preference we host on Google (the
  // only way to mint a Meet link); otherwise the rep's primary (Google-first).
  const googleAccount = opts.accounts.find((a) => a.provider === "google");
  const host = opts.videoProvider === "google_meet" && googleAccount ? googleAccount : opts.accounts[0];

  // Decide the video link. Meet is only possible on a Google-hosted event and
  // isn't wanted when the preference is Zoom. Otherwise create a Zoom meeting.
  const useMeet = host.provider === "google" && opts.videoProvider !== "zoom";
  let zoomLink = "";
  if (!useMeet) {
    const zoom = await getZoomAccount(opts.userId);
    if (zoom) {
      const z = await createZoomMeeting(zoom, {
        topic: opts.summary,
        startMs: opts.startMs,
        durationMinutes: (opts.endMs - opts.startMs) / 60_000,
      });
      if (z.joinUrl) zoomLink = z.joinUrl;
    }
  }

  const created = await createEventOn(host, {
    summary: opts.summary,
    description,
    startISO,
    endISO,
    startMs: opts.startMs,
    endMs: opts.endMs,
    timeZone: opts.timeZone,
    inviteeEmail: opts.inviteeEmail,
    inviteeName: opts.inviteeName,
    videoLink: useMeet ? undefined : zoomLink,
  });
  if (created.error || !created.event) {
    return { ok: false, error: created.error ?? "Couldn't create the calendar event." };
  }

  const admin = createAdminClient();
  const { data: inserted } = await admin
    .from("calendar_bookings")
    .insert({
      user_id: opts.userId,
      provider: host.provider,
      google_account_id: host.provider === "google" ? host.id : null,
      microsoft_account_id: host.provider === "microsoft" ? host.id : null,
      google_event_id: created.event.eventId,
      meet_link: created.event.meetLink,
      html_link: created.event.htmlLink,
      invitee_name: opts.inviteeName,
      invitee_email: opts.inviteeEmail,
      invitee_phone: opts.invitePhone,
      invitee_notes: opts.notes,
      start_at: new Date(opts.startMs).toISOString(),
      end_at: new Date(opts.endMs).toISOString(),
      time_zone: opts.displayTimeZone,
      status: "confirmed",
      manage_token: manageToken,
      rebook_path: opts.rebookPath,
    })
    .select("id")
    .maybeSingle();

  // Confirmation email with .ics. Non-fatal — the meeting is already booked and
  // Google also sends the native invite (sendUpdates=all).
  try {
    const email = buildBookingEmail({
      inviteeName: opts.inviteeName,
      hostName: opts.hostName,
      startMs: opts.startMs,
      endMs: opts.endMs,
      timeZone: opts.displayTimeZone,
      meetLink: created.event.meetLink,
      notes: opts.notes,
      manageUrl,
    });
    const ics = buildIcs({
      // Share the Google event's iCalUID so the invitee's client treats our .ics
      // and Google's native invite as the same event (no duplicate calendar hold,
      // and our cancellation removes it).
      uid: created.event.iCalUID || `${(inserted as { id?: string } | null)?.id ?? created.event.eventId}@joinwingman.app`,
      startMs: opts.startMs,
      endMs: opts.endMs,
      summary: opts.summary,
      description: created.event.meetLink ? `Join the video call: ${created.event.meetLink}` : opts.summary,
      location: created.event.meetLink,
      organizerName: opts.hostName,
      organizerEmail: host.email,
      attendeeName: opts.inviteeName,
      attendeeEmail: opts.inviteeEmail,
      createdMs: opts.nowMs,
    });
    await sendEmail({
      to: [opts.inviteeEmail],
      cc: host.email ? [host.email] : undefined,
      subject: email.subject,
      html: email.html,
      replyTo: host.email || undefined,
      attachments: [
        { filename: "invite.ics", content: Buffer.from(ics, "utf8").toString("base64"), contentType: "text/calendar; method=REQUEST" },
      ],
    });
  } catch {
    // swallow — booking already succeeded
  }

  // Confirmation SMS (best-effort) when the guest gave a phone and Twilio is set up.
  if (opts.invitePhone && twilioConfigured()) {
    try {
      const dateLabel = formatDateLong(opts.startMs, opts.displayTimeZone);
      const timeLabel = formatTime(opts.startMs, opts.displayTimeZone);
      const link = created.event.meetLink ? ` Join: ${created.event.meetLink}` : "";
      await sendSms(
        opts.invitePhone,
        `You're booked with ${opts.hostName} on ${dateLabel} at ${timeLabel}.${link} — Wingman`,
      );
    } catch {
      // ignore
    }
  }

  return { ok: true, meetLink: created.event.meetLink, startMs: opts.startMs };
}

// Create a single-rep booking: re-validate the slot, then finalize.
export async function createBooking(opts: {
  settings: CalendarSettings;
  hostName: string;
  startMs: number;
  inviteeName: string;
  inviteeEmail: string;
  invitePhone: string;
  notes: string;
  displayTimeZone: string;
  nowMs: number;
}): Promise<BookResult> {
  const { settings, startMs, nowMs } = opts;
  const endMs = startMs + settings.meeting_duration_minutes * 60_000;

  const accounts = await listCalendarAccounts(settings.user_id);
  if (!accounts.length) return { ok: false, error: "This calendar isn't connected right now." };

  const open = await getAvailableSlots(settings, nowMs);
  if (!open.some((s) => s.startMs === startMs)) {
    return { ok: false, error: "That time was just taken. Please pick another slot.", code: "slot_taken" };
  }

  return finalizeBooking({
    userId: settings.user_id,
    accounts,
    videoProvider: settings.video_provider,
    hostName: opts.hostName,
    summary: settings.page_title || `Meeting with ${opts.hostName}`,
    timeZone: settings.time_zone,
    displayTimeZone: opts.displayTimeZone,
    startMs,
    endMs,
    inviteeName: opts.inviteeName,
    inviteeEmail: opts.inviteeEmail,
    invitePhone: opts.invitePhone,
    notes: opts.notes,
    rebookPath: `/book/${settings.slug}`,
    nowMs,
  });
}

// ---------------------------------------------------------------------------
// Round-robin demo pool
// ---------------------------------------------------------------------------

// Merged busy per pool member (null = member has no connected calendar, so they
// can't host and are treated as unavailable).
async function memberBusyMap(
  members: CalendarSettings[],
  fromMs: number,
  toMs: number,
): Promise<{ member: CalendarSettings; accounts: CalendarAccount[]; busy: { start: number; end: number }[] | null }[]> {
  return Promise.all(
    members.map(async (member) => {
      const accounts = await listCalendarAccounts(member.user_id);
      const busy = accounts.length ? await mergedFreeBusyAll(accounts, fromMs, toMs) : null;
      return { member, accounts, busy };
    }),
  );
}

// Demo-pool slots: candidate times from the shared demo config where AT LEAST ONE
// pooled rep is free.
export async function getDemoPoolSlots(config: DemoPoolConfig, members: CalendarSettings[], nowMs: number): Promise<Slot[]> {
  if (!members.length) return [];
  const candidates = computeSlots({
    rules: config.availability,
    timeZone: config.time_zone,
    durationMinutes: config.meeting_duration_minutes,
    bufferMinutes: config.buffer_minutes,
    advanceNoticeHours: config.advance_notice_hours,
    windowDays: config.booking_window_days,
    nowMs,
    busy: [], // filter by member availability below
  });
  const windowEnd = nowMs + config.booking_window_days * 86_400_000;
  const busyMap = await memberBusyMap(members, nowMs, windowEnd);
  const bufferMs = config.buffer_minutes * 60_000;
  return candidates.filter((slot) =>
    busyMap.some(({ busy }) => busy !== null && intervalIsFree(slot.startMs - bufferMs, slot.endMs + bufferMs, busy)),
  );
}

// Book a demo round-robin: pick the least-loaded rep who is free at the chosen
// time, then finalize on their calendar.
export async function createDemoBooking(opts: {
  config: DemoPoolConfig;
  members: CalendarSettings[];
  startMs: number;
  inviteeName: string;
  inviteeEmail: string;
  invitePhone: string;
  notes: string;
  displayTimeZone: string;
  nowMs: number;
}): Promise<BookResult> {
  const { config, members, startMs, nowMs } = opts;
  const endMs = startMs + config.meeting_duration_minutes * 60_000;
  if (!members.length) return { ok: false, error: "No demo hosts are available right now." };

  // Validate the chosen time falls in the demo working hours + notice window.
  const candidates = computeSlots({
    rules: config.availability,
    timeZone: config.time_zone,
    durationMinutes: config.meeting_duration_minutes,
    bufferMinutes: config.buffer_minutes,
    advanceNoticeHours: config.advance_notice_hours,
    windowDays: config.booking_window_days,
    nowMs,
    busy: [],
  });
  if (!candidates.some((s) => s.startMs === startMs)) {
    return { ok: false, error: "That time isn't available. Please pick another slot.", code: "slot_taken" };
  }

  const busyMap = await memberBusyMap(members, startMs - 60_000, endMs + 60_000);
  const bufferMs = config.buffer_minutes * 60_000;
  const free = busyMap.filter(
    ({ busy, accounts }) => accounts.length > 0 && busy !== null && intervalIsFree(startMs - bufferMs, endMs + bufferMs, busy),
  );
  if (!free.length) {
    return { ok: false, error: "That time was just taken. Please pick another slot.", code: "slot_taken" };
  }

  // Least-loaded: fewest upcoming confirmed bookings wins (fair round-robin).
  const admin = createAdminClient();
  const loads = await Promise.all(
    free.map(async ({ member }) => {
      const { count } = await admin
        .from("calendar_bookings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", member.user_id)
        .eq("status", "confirmed")
        .gte("end_at", new Date(nowMs).toISOString());
      return { entry: free.find((f) => f.member.user_id === member.user_id)!, load: count ?? 0 };
    }),
  );
  loads.sort((a, b) => a.load - b.load || a.entry.member.user_id.localeCompare(b.entry.member.user_id));
  const chosen = loads[0].entry;

  // Host display name.
  const { data: host } = await admin.from("profiles").select("full_name").eq("id", chosen.member.user_id).maybeSingle();
  const hostName = (host as { full_name?: string } | null)?.full_name || "the Wingman team";

  return finalizeBooking({
    userId: chosen.member.user_id,
    accounts: chosen.accounts,
    videoProvider: chosen.member.video_provider,
    hostName,
    summary: config.page_title || "Wingman demo",
    timeZone: config.time_zone,
    displayTimeZone: opts.displayTimeZone,
    startMs,
    endMs,
    inviteeName: opts.inviteeName,
    inviteeEmail: opts.inviteeEmail,
    invitePhone: opts.invitePhone,
    notes: opts.notes,
    rebookPath: "/book-a-demo",
    nowMs,
  });
}

// ---------------------------------------------------------------------------
// Manage / cancel
// ---------------------------------------------------------------------------

export type ManagedBooking = {
  id: string;
  hostName: string;
  startMs: number;
  endMs: number;
  timeZone: string;
  meetLink: string;
  status: string;
  rebookPath: string;
};

// Public lookup by manage token — non-secret fields only, for the self-serve
// manage page.
export async function getBookingByToken(token: string): Promise<ManagedBooking | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_bookings")
    .select("id, user_id, start_at, end_at, time_zone, meet_link, status, rebook_path")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    user_id: string;
    start_at: string;
    end_at: string;
    time_zone: string;
    meet_link: string;
    status: string;
    rebook_path: string;
  };
  const { data: host } = await admin.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle();
  return {
    id: row.id,
    hostName: (host as { full_name?: string } | null)?.full_name || "the Wingman team",
    startMs: new Date(row.start_at).getTime(),
    endMs: new Date(row.end_at).getTime(),
    timeZone: row.time_zone || "America/New_York",
    meetLink: row.meet_link,
    status: row.status,
    rebookPath: row.rebook_path || "/book-a-demo",
  };
}

// Cancel by manage token: remove the Google event, mark cancelled, and email the
// guest a rebook link. Idempotent — cancelling an already-cancelled booking is a
// no-op success.
export async function cancelBookingByToken(token: string): Promise<{ ok: boolean; error?: string; rebookPath?: string }> {
  if (!token) return { ok: false, error: "Missing token." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_bookings")
    .select("id, user_id, provider, google_account_id, microsoft_account_id, google_event_id, invitee_name, invitee_email, start_at, time_zone, status, rebook_path")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data) return { ok: false, error: "Booking not found." };
  const row = data as {
    id: string;
    user_id: string;
    provider: string | null;
    google_account_id: string | null;
    microsoft_account_id: string | null;
    google_event_id: string;
    invitee_name: string;
    invitee_email: string;
    start_at: string;
    time_zone: string;
    status: string;
    rebook_path: string;
  };
  if (row.status === "cancelled") return { ok: true, rebookPath: row.rebook_path || "/book-a-demo" };

  // Delete the calendar event on the hosting provider (best-effort).
  if (row.google_event_id) {
    if (row.provider === "microsoft" && row.microsoft_account_id) {
      const { data: acct } = await admin.from("calendar_microsoft_accounts").select("*").eq("id", row.microsoft_account_id).maybeSingle();
      if (acct) await deleteEventOn({ provider: "microsoft", ...(acct as MicrosoftAccountRow) }, row.google_event_id);
    } else if (row.google_account_id) {
      const { data: acct } = await admin.from("calendar_google_accounts").select("*").eq("id", row.google_account_id).maybeSingle();
      if (acct) await deleteEventOn({ provider: "google", ...(acct as GoogleAccountRow) }, row.google_event_id);
    }
  }

  await admin
    .from("calendar_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", row.id);

  // Rebook email (best-effort).
  try {
    const { data: host } = await admin.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle();
    const hostName = (host as { full_name?: string } | null)?.full_name || "the Wingman team";
    const rebookPath = row.rebook_path || "/book-a-demo";
    const email = buildCancellationEmail({
      inviteeName: row.invitee_name,
      hostName,
      startMs: new Date(row.start_at).getTime(),
      timeZone: row.time_zone || "America/New_York",
      rebookUrl: `${siteUrl()}${rebookPath}`,
    });
    if (row.invitee_email) {
      await sendEmail({ to: [row.invitee_email], subject: email.subject, html: email.html });
    }
  } catch {
    // ignore
  }

  return { ok: true, rebookPath: row.rebook_path || "/book-a-demo" };
}

// Serializable slot for the browser: epoch ms + preformatted labels in a tz,
// plus a "YYYY-MM-DD" day key so the client can group by calendar day.
export function serializeSlots(slots: Slot[], timeZone: string) {
  return slots.map((s) => ({
    start: s.startMs,
    end: s.endMs,
    day: formatDayKey(s.startMs, timeZone),
    date: formatDateLong(s.startMs, timeZone),
    time: formatTime(s.startMs, timeZone),
  }));
}
