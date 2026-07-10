import "server-only";
import { sendEmail } from "@/lib/email";

// Where new tickets / customer replies are emailed. A shared inbox so the team
// can triage and assign, rather than a personal address.
export const SUPPORT_INBOX = "hello@joinwingman.app";
// Sent from the verified `updates.` subdomain; replies route back to the real
// hello@joinwingman.app inbox via Reply-To (set on each send below).
const SUPPORT_FROM = "Wingman Support <hello@updates.joinwingman.app>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.joinwingman.app";

export type TicketStatus = "open" | "pending" | "closed";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function shell(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">${inner}</div>`;
}
function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0a6cff;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">${label}</a>`;
}
function quote(body: string): string {
  return `<div style="border-left:3px solid #e5e5e5;padding:2px 0 2px 14px;color:#525252;font-size:15px;line-height:1.55;white-space:pre-wrap;">${esc(body)}</div>`;
}

// Fire-and-forget: notifications should never block or fail the ticket action.

export async function notifySupportNewTicket(o: { orgName: string; fromName: string; subject: string; body: string; ticketId: string }): Promise<void> {
  await sendEmail({
    to: [SUPPORT_INBOX],
    from: SUPPORT_FROM,
    replyTo: SUPPORT_INBOX,
    subject: `New ticket — ${o.orgName}: ${o.subject}`,
    html: shell(`
      <h2 style="font-size:18px;margin:0 0 6px;">New support ticket</h2>
      <p style="font-size:14px;color:#737373;margin:0 0 14px;">From <strong>${esc(o.fromName)}</strong> at <strong>${esc(o.orgName)}</strong></p>
      <p style="font-size:16px;font-weight:600;margin:0 0 8px;">${esc(o.subject)}</p>
      ${quote(o.body)}
      <p style="margin:22px 0;">${button("Open in admin", `${SITE}/admin/support/${o.ticketId}`)}</p>
    `),
  }).catch(() => {});
}

export async function notifySupportReply(o: { orgName: string; fromName: string; subject: string; body: string; ticketId: string }): Promise<void> {
  await sendEmail({
    to: [SUPPORT_INBOX],
    from: SUPPORT_FROM,
    replyTo: SUPPORT_INBOX,
    subject: `New reply — ${o.orgName}: ${o.subject}`,
    html: shell(`
      <h2 style="font-size:18px;margin:0 0 6px;">New reply on a ticket</h2>
      <p style="font-size:14px;color:#737373;margin:0 0 14px;"><strong>${esc(o.fromName)}</strong> (${esc(o.orgName)}) replied to “${esc(o.subject)}”.</p>
      ${quote(o.body)}
      <p style="margin:22px 0;">${button("Open in admin", `${SITE}/admin/support/${o.ticketId}`)}</p>
    `),
  }).catch(() => {});
}

export async function notifyCustomerReply(o: { toEmail: string; subject: string; body: string; ticketId: string }): Promise<void> {
  if (!o.toEmail) return;
  await sendEmail({
    to: [o.toEmail],
    from: SUPPORT_FROM,
    replyTo: SUPPORT_INBOX,
    subject: `Re: ${o.subject} — Wingman Support`,
    html: shell(`
      <h2 style="font-size:18px;margin:0 0 10px;">Wingman Support replied</h2>
      ${quote(o.body)}
      <p style="margin:22px 0;">${button("View & reply", `${SITE}/support/${o.ticketId}`)}</p>
      <p style="font-size:13px;color:#737373;">You can reply from your Wingman account under <strong>Support</strong>.</p>
    `),
  }).catch(() => {});
}
