import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAffiliateSettings } from "@/lib/affiliate";

// -----------------------------------------------------------------------------
// Affiliate commission engine (Phase 2).
//
// Driven by real "payment succeeded" events from the payments webhook, with the
// monthly cron as a safety net. Both call recordReferralPayment(), which is
// idempotent per org per calendar month (unique constraint on org_id,
// period_month), so running both never double-accrues.
// -----------------------------------------------------------------------------

const BASE_CENTS = 19900; // $199 first location
const ADDL_CENTS = 10000; // $100 each additional location

function monthStartISO(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// Monthly subscription for an org from its location count (matches published
// pricing). Used until the payment processor sends real amounts.
export async function monthlySubscriptionCents(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin.from("locations").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  const locations = Math.max(1, count ?? 1);
  return BASE_CENTS + ADDL_CENTS * (locations - 1);
}

// Record one successful payment for a referred org: approve the previously-held
// commission (their prior payment has now cleared), then accrue this month's
// commission as pending. No-ops if the org isn't a referred, approved-affiliate,
// active account, or if the commission term is complete.
export async function recordReferralPayment(admin: SupabaseClient, orgId: string): Promise<void> {
  const { data: org } = await admin
    .from("organizations")
    .select("referred_by_affiliate_id, billing_status")
    .eq("id", orgId)
    .maybeSingle();
  const o = org as { referred_by_affiliate_id: string | null; billing_status: string } | null;
  if (!o?.referred_by_affiliate_id) return;
  if (o.billing_status !== "active") return;

  const affiliateId = o.referred_by_affiliate_id;
  const { data: aff } = await admin.from("affiliates").select("status, commission_pct").eq("id", affiliateId).maybeSingle();
  const a = aff as { status: string; commission_pct: number | null } | null;
  if (!a || a.status !== "approved") return;

  const settings = await getAffiliateSettings(admin);
  const pct = a.commission_pct ?? settings.default_commission_pct;

  // Count non-void commissions already accrued for this org (= months paid).
  const { count: accrued } = await admin
    .from("affiliate_commissions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .neq("status", "void");

  const month = monthStartISO();

  // Their latest payment clears the previously-held month: approve any pending
  // commission from a prior month.
  await admin
    .from("affiliate_commissions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("status", "pending")
    .lt("period_month", month);

  // Stop accruing once the commission term is complete.
  if ((accrued ?? 0) >= settings.default_term_months) return;

  const subscription = await monthlySubscriptionCents(admin, orgId);
  const amount = Math.round((subscription * pct) / 100);

  // Insert this month's commission (pending). Unique(org_id, period_month) makes
  // this idempotent if called more than once in a month.
  await admin
    .from("affiliate_commissions")
    .insert({ affiliate_id: affiliateId, org_id: orgId, period_month: month, amount_cents: amount, status: "pending" });
}

// Clawback: on refund/cancel, void anything still pending for the org (approved
// or paid commissions are left alone — those are handled by the payout ledger).
export async function voidPendingForOrg(admin: SupabaseClient, orgId: string): Promise<void> {
  await admin.from("affiliate_commissions").update({ status: "void" }).eq("org_id", orgId).eq("status", "pending");
}

// Accrue for every active referred org (monthly cron / safety net).
export async function accrueAllActiveReferrals(admin: SupabaseClient): Promise<{ processed: number }> {
  const { data: orgs } = await admin
    .from("organizations")
    .select("id")
    .not("referred_by_affiliate_id", "is", null)
    .eq("billing_status", "active");
  const list = (orgs ?? []) as { id: string }[];
  for (const org of list) {
    await recordReferralPayment(admin, org.id);
  }
  return { processed: list.length };
}

export type CommissionSummary = { pendingCents: number; approvedCents: number; paidCents: number };

export async function commissionSummaryForAffiliate(admin: SupabaseClient, affiliateId: string): Promise<CommissionSummary> {
  const { data } = await admin.from("affiliate_commissions").select("amount_cents, status").eq("affiliate_id", affiliateId);
  const rows = (data ?? []) as { amount_cents: number; status: string }[];
  const sum = (status: string) => rows.filter((r) => r.status === status).reduce((t, r) => t + r.amount_cents, 0);
  return { pendingCents: sum("pending"), approvedCents: sum("approved"), paidCents: sum("paid") };
}

// Owed (approved, not yet paid) totals per affiliate, for the admin view.
export async function owedByAffiliate(admin: SupabaseClient): Promise<Map<string, number>> {
  const { data } = await admin.from("affiliate_commissions").select("affiliate_id, amount_cents").eq("status", "approved");
  const rows = (data ?? []) as { affiliate_id: string; amount_cents: number }[];
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.affiliate_id, (map.get(r.affiliate_id) ?? 0) + r.amount_cents);
  return map;
}
