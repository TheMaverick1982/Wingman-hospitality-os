import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { markOrgChurned, markOrgPaid } from "@/lib/crm-sequences";

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
  card?: { brand?: string; last4?: string; periodEnd?: string }
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
}

export async function markCanceled(admin: SupabaseClient, orgId: string): Promise<void> {
  await admin.from("organizations").update({ billing_status: "canceled" }).eq("id", orgId);
  // Move the linked CRM contact to Past Clients and start the Reactivation
  // sequence so we can win them back.
  await markOrgChurned(admin, orgId);
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
