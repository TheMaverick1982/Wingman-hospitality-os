import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { markOrgChurned, markOrgPaid } from "@/lib/crm-sequences";
import { effectiveMonthlyCents } from "@/lib/pricing";

// Operator alerts (payment failures, closures) go here.
export const BILLING_OWNER_EMAIL = "brian@brianhardy.com";
// Days a past-due account is retried/reminded before closure (matches the Terms).
export const GRACE_PERIOD_DAYS = 30;
// Days between "please update your card" nudges to the customer while past due.
export const CUSTOMER_NUDGE_INTERVAL_DAYS = 7;

// Where the customer manages their card. Set NEXT_PUBLIC_BILLING_PORTAL_URL to
// the processor's hosted card-update page once it's connected; until then this
// points at Settings.
const PORTAL_URL = process.env.NEXT_PUBLIC_BILLING_PORTAL_URL || "https://www.joinwingman.app/settings";

export type BillingStatus = "free" | "active" | "past_due" | "canceled";

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

// ---------------------------------------------------------------------------
// Email content
// ---------------------------------------------------------------------------
// Escape any value that gets interpolated into email HTML. Org names are set by
// customers, so treat them as untrusted when they land in markup (belt-and-
// suspenders: these emails go to the customer's own owners and the operator).
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function shell(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;">${inner}</div>`;
}
function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0a6cff;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">${label}</a>`;
}

function customerNudgeHtml(orgName: string): string {
  const name = esc(orgName);
  return shell(`
    <h2 style="font-size:20px;margin:0 0 12px;">Your Wingman payment didn't go through</h2>
    <p style="font-size:15px;line-height:1.55;color:#525252;">We couldn't process the latest payment for <strong>${name}</strong>. To keep your account active, please update your payment method.</p>
    <p style="margin:22px 0;">${button("Update payment method", PORTAL_URL)}</p>
    <p style="font-size:13px;line-height:1.5;color:#737373;">If the balance stays unpaid for 30 days, your account may be suspended and closed. Questions? Just reply to this email.</p>
  `);
}
function ownerFailedHtml(orgName: string): string {
  const name = esc(orgName);
  return shell(`
    <h2 style="font-size:18px;margin:0 0 10px;">Payment failed — ${name}</h2>
    <p style="font-size:15px;line-height:1.55;color:#525252;">A payment just failed for <strong>${name}</strong>. They've been emailed to update their card and are now in the 30-day grace window. Reach out if you'd like to.</p>
  `);
}
function ownerClosureHtml(orgName: string, days: number): string {
  const name = esc(orgName);
  return shell(`
    <h2 style="font-size:18px;margin:0 0 10px;">Closed for non-payment — ${name}</h2>
    <p style="font-size:15px;line-height:1.55;color:#525252;"><strong>${name}</strong> has been past due for ${Math.round(days)} days and is now being closed for non-payment per the Terms. Follow up if you want to try to save the account before their data is removed.</p>
  `);
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Branded payment receipt, sent to the account owner(s) and any accounting email
// on every successful charge.
function receiptHtml(
  orgName: string,
  amountCents: number,
  opts: { dateLabel: string; brand?: string | null; last4?: string | null; invoiceNumber?: string | null; nextBillLabel?: string | null }
): string {
  const name = esc(orgName);
  const rowStyle = 'style="font-size:14px;color:#525252;padding:6px 0;"';
  const valStyle = 'style="font-size:14px;color:#1a1a1a;font-weight:600;padding:6px 0;text-align:right;"';
  const rows = [
    `<tr><td ${rowStyle}>Amount paid</td><td ${valStyle}>${money(amountCents)}</td></tr>`,
    `<tr><td ${rowStyle}>Date</td><td ${valStyle}>${esc(opts.dateLabel)}</td></tr>`,
    opts.last4 ? `<tr><td ${rowStyle}>Payment method</td><td ${valStyle}>${esc(opts.brand ?? "Card")} ····${esc(opts.last4)}</td></tr>` : "",
    opts.invoiceNumber ? `<tr><td ${rowStyle}>Invoice</td><td ${valStyle}>${esc(opts.invoiceNumber)}</td></tr>` : "",
    opts.nextBillLabel ? `<tr><td ${rowStyle}>Next billing date</td><td ${valStyle}>${esc(opts.nextBillLabel)}</td></tr>` : "",
  ].filter(Boolean).join("");
  return shell(`
    <h2 style="font-size:20px;margin:0 0 6px;">Payment received — thank you</h2>
    <p style="font-size:15px;line-height:1.55;color:#525252;margin:0 0 16px;">We've received your Wingman subscription payment for <strong>${name}</strong>. Here's your receipt.</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ECECEC;border-bottom:1px solid #ECECEC;margin:0 0 18px;">${rows}</table>
    <p style="margin:0 0 22px;">${button("View billing & invoices", "https://www.joinwingman.app/settings")}</p>
    <p style="font-size:12px;line-height:1.5;color:#8a8a8a;">Billed by The Maverick Agency — charges appear on your statement as "The Maverick Agency." Questions? Just reply to this email.</p>
  `);
}

// Reminder shown when a canceling org still has live API integrations, so their
// POS/Zapier feed doesn't keep pushing data after they leave.
function apiDisconnectBlock(hasApi: boolean): string {
  if (!hasApi) return "";
  return `<div style="margin:16px 0;padding:12px 14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;">
    <p style="font-size:14px;line-height:1.5;color:#9A3412;margin:0;"><strong>Heads up:</strong> your account still has an active API connection (your POS or a Zapier automation). Disconnect it so it stops sending data — in Wingman go to <strong>Settings → API access</strong> and revoke your keys, and turn off the matching Zap on your side.</p>
  </div>`;
}

function cancellationConfirmHtml(orgName: string, periodEndLabel: string | null, hasApi: boolean): string {
  const name = esc(orgName);
  const until = periodEndLabel
    ? `Your account stays active until <strong>${esc(periodEndLabel)}</strong>, the end of your current billing period. You won't be charged again.`
    : `Your account stays active until the end of your current billing period. You won't be charged again.`;
  return shell(`
    <h2 style="font-size:20px;margin:0 0 10px;">Your subscription is set to cancel</h2>
    <p style="font-size:15px;line-height:1.55;color:#525252;">We've scheduled cancellation for <strong>${name}</strong>. ${until}</p>
    ${apiDisconnectBlock(hasApi)}
    <p style="font-size:14px;line-height:1.55;color:#525252;">Changed your mind? You can resume anytime before then from <strong>Settings → Billing</strong>. We'd love to keep helping your team.</p>
    <p style="font-size:13px;line-height:1.5;color:#737373;">Questions, or want to talk it through? Just reply to this email.</p>
  `);
}

function ownerCancelRequestHtml(orgName: string, hasApi: boolean): string {
  const name = esc(orgName);
  return shell(`
    <h2 style="font-size:18px;margin:0 0 10px;">Cancellation requested — ${name}</h2>
    <p style="font-size:15px;line-height:1.55;color:#525252;"><strong>${name}</strong> just requested to cancel at period end via self-serve. Process the cancellation with the payment processor so they aren't charged again.${hasApi ? " They also still have an active API integration — they've been reminded to disconnect it." : ""} Reach out if you'd like to try to save them.</p>
  `);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export async function getOrgOwnerEmails(admin: SupabaseClient, orgId: string): Promise<string[]> {
  const { data: owners } = await admin.from("profiles").select("id").eq("org_id", orgId).eq("access_role", "super_admin");
  const emails: string[] = [];
  for (const o of (owners ?? []) as { id: string }[]) {
    try {
      const { data } = await admin.auth.admin.getUserById(o.id);
      const email = data?.user?.email;
      if (email) emails.push(email);
    } catch {
      /* skip a member we can't resolve */
    }
  }
  return emails;
}

// ---------------------------------------------------------------------------
// State transitions (call these from the payment webhook)
// ---------------------------------------------------------------------------
export async function markPastDue(admin: SupabaseClient, orgId: string, orgName: string): Promise<void> {
  const { data: org } = await admin.from("organizations").select("payment_failed_at").eq("id", orgId).single();
  const failedAt = (org as { payment_failed_at?: string } | null)?.payment_failed_at ?? new Date().toISOString();
  await admin
    .from("organizations")
    .update({ billing_status: "past_due", payment_failed_at: failedAt, dunning_last_notified_at: new Date().toISOString() })
    .eq("id", orgId);

  const emails = await getOrgOwnerEmails(admin, orgId);
  if (emails.length) {
    await sendEmail({
      to: emails,
      subject: "Action needed: update your Wingman payment method",
      html: customerNudgeHtml(orgName),
    }).catch(() => {});
  }
  await sendEmail({
    to: [BILLING_OWNER_EMAIL],
    subject: `⚠️ Payment failed — ${orgName}`,
    html: ownerFailedHtml(orgName),
  }).catch(() => {});
}

export async function markActive(
  admin: SupabaseClient,
  orgId: string,
  card?: { brand?: string; last4?: string; periodEnd?: string },
  receipt?: { amountCents?: number; invoiceNumber?: string; paidAtIso?: string }
): Promise<void> {
  await admin
    .from("organizations")
    .update({
      billing_status: "active",
      payment_failed_at: null,
      dunning_last_notified_at: null,
      ...(card?.brand ? { card_brand: card.brand } : {}),
      ...(card?.last4 ? { card_last4: card.last4 } : {}),
      ...(card?.periodEnd ? { current_period_end: card.periodEnd } : {}),
    })
    .eq("id", orgId);
  // A cleared payment moves the linked CRM contact back to Signed Up and stops
  // any running Reactivation win-back.
  await markOrgPaid(admin, orgId);
  // Send the branded receipt to the owner(s) + any accounting email. Never let a
  // receipt hiccup fail the payment webhook.
  await sendPaymentReceipt(admin, orgId, card, receipt).catch(() => {});
}

// Email a branded receipt for a successful charge. Free accounts and zero-dollar
// events are skipped. Amount comes from the processor when provided, else falls
// back to the org's effective monthly price.
async function sendPaymentReceipt(
  admin: SupabaseClient,
  orgId: string,
  card?: { brand?: string; last4?: string; periodEnd?: string },
  receipt?: { amountCents?: number; invoiceNumber?: string; paidAtIso?: string }
): Promise<void> {
  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, is_free_account, billing_email, custom_monthly_cents, custom_addl_location_cents")
    .eq("id", orgId)
    .maybeSingle();
  const org = orgRow as
    | { name: string; is_free_account: boolean; billing_email: string | null; custom_monthly_cents: number | null; custom_addl_location_cents: number | null }
    | null;
  if (!org || org.is_free_account) return;

  let amountCents = receipt?.amountCents;
  if (amountCents == null) {
    const { count } = await admin.from("locations").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    amountCents = await effectiveMonthlyCents(org, count ?? 1);
  }
  if (!amountCents || amountCents <= 0) return;

  const recipients = [...new Set([...(await getOrgOwnerEmails(admin, orgId)), org.billing_email].filter(Boolean))] as string[];
  if (recipients.length === 0) return;

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  await sendEmail({
    to: recipients,
    subject: `Wingman receipt — ${money(amountCents)} paid`,
    html: receiptHtml(org.name, amountCents, {
      dateLabel: fmtDate(receipt?.paidAtIso) ?? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      brand: card?.brand,
      last4: card?.last4,
      invoiceNumber: receipt?.invoiceNumber,
      nextBillLabel: fmtDate(card?.periodEnd),
    }),
  });
}

export async function markCanceled(admin: SupabaseClient, orgId: string): Promise<void> {
  await admin.from("organizations").update({ billing_status: "canceled" }).eq("id", orgId);
  // Move the linked CRM contact to Past Clients and start the Reactivation
  // sequence so we can win them back.
  await markOrgChurned(admin, orgId);
}

// Self-serve cancellation: the owner schedules cancellation for the end of the
// current period (keeps access until then, no future charge). Emails the customer
// a confirmation (with an API-disconnect reminder if they have integrations) and
// alerts the operator to finalize it with the processor. When the processor is
// wired, also call its cancel-at-period-end API here.
export async function requestOrgCancellation(admin: SupabaseClient, orgId: string): Promise<void> {
  await admin.from("organizations").update({ cancel_at_period_end: true }).eq("id", orgId);

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, current_period_end, billing_email")
    .eq("id", orgId)
    .maybeSingle();
  const org = orgRow as { name: string; current_period_end: string | null; billing_email: string | null } | null;
  const name = org?.name ?? "your organization";

  const { count: apiCount } = await admin
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("revoked_at", null);
  const hasApi = (apiCount ?? 0) > 0;

  const periodEndLabel = org?.current_period_end
    ? new Date(org.current_period_end).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const recipients = [...new Set([...(await getOrgOwnerEmails(admin, orgId)), org?.billing_email].filter(Boolean))] as string[];
  if (recipients.length) {
    await sendEmail({
      to: recipients,
      subject: "Your Wingman subscription is set to cancel",
      html: cancellationConfirmHtml(name, periodEndLabel, hasApi),
    }).catch(() => {});
  }
  await sendEmail({
    to: [BILLING_OWNER_EMAIL],
    subject: `Cancellation requested — ${name}`,
    html: ownerCancelRequestHtml(name, hasApi),
  }).catch(() => {});
}

// Owner changed their mind before the period ended.
export async function resumeOrgSubscription(admin: SupabaseClient, orgId: string): Promise<void> {
  await admin.from("organizations").update({ cancel_at_period_end: false }).eq("id", orgId);
}

// ---------------------------------------------------------------------------
// Daily dunning step (called by the cron for each past-due org)
// ---------------------------------------------------------------------------
type DunningOrg = { id: string; name: string; payment_failed_at: string | null; dunning_last_notified_at: string | null };

export async function runDunningForOrg(admin: SupabaseClient, org: DunningOrg): Promise<string> {
  const days = daysSince(org.payment_failed_at);

  // 30 days unpaid -> close the account and alert the owner (per the Terms).
  if (days >= GRACE_PERIOD_DAYS) {
    await markCanceled(admin, org.id);
    await sendEmail({
      to: [BILLING_OWNER_EMAIL],
      subject: `❌ Account closed for non-payment — ${org.name}`,
      html: ownerClosureHtml(org.name, days),
    }).catch(() => {});
    return `closed:${org.id}`;
  }

  // Otherwise, re-nudge the customer on the interval.
  if (daysSince(org.dunning_last_notified_at) >= CUSTOMER_NUDGE_INTERVAL_DAYS) {
    const emails = await getOrgOwnerEmails(admin, org.id);
    if (emails.length) {
      await sendEmail({
        to: emails,
        subject: "Reminder: update your Wingman payment method",
        html: customerNudgeHtml(org.name),
      }).catch(() => {});
    }
    await admin.from("organizations").update({ dunning_last_notified_at: new Date().toISOString() }).eq("id", org.id);
    return `nudged:${org.id}`;
  }

  return `waiting:${org.id}`;
}
