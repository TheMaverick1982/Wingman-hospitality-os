import "server-only";
import { formatDateLong, formatTime } from "./availability";

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

function whenLabels(startMs: number, endMs: number, timeZone: string) {
  const dateLabel = formatDateLong(startMs, timeZone);
  const startLabel = formatTime(startMs, timeZone);
  const endLabel = formatTime(endMs, timeZone);
  const tzShort =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(startMs))
      .find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  return { dateLabel, startLabel, endLabel, tzShort };
}

function shell(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:560px;">${inner}</div>`;
}

function whenCard(dateLabel: string, startLabel: string, endLabel: string, tzShort: string): string {
  return `<div style="background:#f5f5f4;border-radius:12px;padding:16px 18px;margin:0 0 18px;">
    <p style="font-size:15px;font-weight:700;margin:0 0 4px;">${esc(dateLabel)}</p>
    <p style="font-size:15px;color:#1a1a1a;margin:0;">${esc(startLabel)} – ${esc(endLabel)} (${esc(tzShort)})</p>
  </div>`;
}

function manageLine(manageUrl: string, hostName: string): string {
  if (!manageUrl) {
    return `<p style="font-size:12px;color:#999;line-height:1.5;">Need to reschedule? Just reply to this email and ${esc(hostName)} will sort it out with you.</p>`;
  }
  return `<p style="font-size:12px;color:#999;line-height:1.5;">Need to change plans? <a href="${esc(manageUrl)}" style="color:#0a6cff;">Reschedule or cancel</a>.</p>`;
}

// Confirmation email for a booked meeting. Sent to the invitee (host cc'd) with an
// .ics attachment; mirrors the inline-styled transactional template used
// elsewhere (see momentum-email.ts).
export function buildBookingEmail(opts: {
  inviteeName: string;
  hostName: string;
  startMs: number;
  endMs: number;
  timeZone: string;
  meetLink: string;
  notes: string;
  manageUrl?: string;
}): { subject: string; html: string } {
  const { dateLabel, startLabel, endLabel, tzShort } = whenLabels(opts.startMs, opts.endMs, opts.timeZone);
  const subject = `Confirmed: your meeting with ${esc(opts.hostName)} on ${esc(dateLabel)}`;

  const meetBlock = opts.meetLink
    ? `<div style="margin:16px 0 8px;">
        <a href="${esc(opts.meetLink)}" style="display:inline-block;background:#0a6cff;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;padding:11px 22px;border-radius:99px;">Join with Google Meet →</a>
      </div>
      <p style="font-size:13px;color:#737373;margin:0 0 4px;">Or paste this link: <a href="${esc(opts.meetLink)}" style="color:#0a6cff;">${esc(opts.meetLink)}</a></p>`
    : `<p style="font-size:14px;color:#525252;margin:0 0 8px;">A video link will follow shortly.</p>`;

  const notesBlock = opts.notes
    ? `<p style="font-size:14px;color:#525252;margin:14px 0 0;"><strong>Your note:</strong> ${esc(opts.notes)}</p>`
    : "";

  const html = shell(`
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#B45309;margin:0 0 6px;">Meeting confirmed</p>
    <h1 style="font-size:21px;font-weight:700;margin:0 0 12px;">You're booked with ${esc(opts.hostName)}</h1>
    <p style="font-size:15px;line-height:1.55;color:#525252;margin:0 0 16px;">Hi ${esc(opts.inviteeName || "there")} — your meeting is confirmed. The details are below and attached as a calendar invite.</p>
    ${whenCard(dateLabel, startLabel, endLabel, tzShort)}
    ${meetBlock}
    ${notesBlock}
    <hr style="border:none;border-top:1px solid #eee;margin:26px 0 12px;">
    ${manageLine(opts.manageUrl ?? "", opts.hostName)}
  `);

  return { subject, html };
}

// Reminder email — part of the pre-appointment series ("day before" and "starting
// soon"). `lead` labels the moment so the copy fits.
export function buildReminderEmail(opts: {
  inviteeName: string;
  hostName: string;
  startMs: number;
  endMs: number;
  timeZone: string;
  meetLink: string;
  lead: "24h" | "1h";
  manageUrl?: string;
}): { subject: string; html: string } {
  const { dateLabel, startLabel, endLabel, tzShort } = whenLabels(opts.startMs, opts.endMs, opts.timeZone);
  const soon = opts.lead === "1h";
  const subject = soon
    ? `Starting soon: your meeting with ${esc(opts.hostName)}`
    : `Reminder: your meeting with ${esc(opts.hostName)} tomorrow`;

  const cta = opts.meetLink
    ? `<div style="margin:16px 0 8px;">
        <a href="${esc(opts.meetLink)}" style="display:inline-block;background:#0a6cff;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;padding:11px 22px;border-radius:99px;">Join with Google Meet →</a>
      </div>`
    : "";

  const html = shell(`
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#B45309;margin:0 0 6px;">${soon ? "Starting soon" : "Reminder"}</p>
    <h1 style="font-size:21px;font-weight:700;margin:0 0 12px;">${soon ? "Your meeting starts soon" : "See you tomorrow"}</h1>
    <p style="font-size:15px;line-height:1.55;color:#525252;margin:0 0 16px;">Hi ${esc(opts.inviteeName || "there")} — a quick reminder of your meeting with ${esc(opts.hostName)}.</p>
    ${whenCard(dateLabel, startLabel, endLabel, tzShort)}
    ${cta}
    <hr style="border:none;border-top:1px solid #eee;margin:26px 0 12px;">
    ${manageLine(opts.manageUrl ?? "", opts.hostName)}
  `);

  return { subject, html };
}

// Cancellation confirmation with a one-tap rebook link.
export function buildCancellationEmail(opts: {
  inviteeName: string;
  hostName: string;
  startMs: number;
  timeZone: string;
  rebookUrl: string;
}): { subject: string; html: string } {
  const dateLabel = formatDateLong(opts.startMs, opts.timeZone);
  const subject = `Cancelled: your meeting with ${esc(opts.hostName)}`;
  const html = shell(`
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#B91C1C;margin:0 0 6px;">Meeting cancelled</p>
    <h1 style="font-size:21px;font-weight:700;margin:0 0 12px;">Your meeting is cancelled</h1>
    <p style="font-size:15px;line-height:1.55;color:#525252;margin:0 0 16px;">Hi ${esc(opts.inviteeName || "there")} — your meeting with ${esc(opts.hostName)} on ${esc(dateLabel)} has been cancelled. No hard feelings — grab a new time whenever works.</p>
    <div style="margin:16px 0 8px;">
      <a href="${esc(opts.rebookUrl)}" style="display:inline-block;background:#0a6cff;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;padding:11px 22px;border-radius:99px;">Pick a new time →</a>
    </div>
  `);
  return { subject, html };
}
