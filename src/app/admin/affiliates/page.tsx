import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAffiliateSettings } from "@/lib/affiliate";
import { owedByAffiliate } from "@/lib/affiliate-commissions";
import { paypalConfigured } from "@/lib/paypal";
import { AffiliatesManager, type AffRow, type ProgramSettings } from "./affiliates-manager";
import { PayoutsPanel, type EligibleRow, type PayoutHistoryRow } from "./payouts-panel";

export const maxDuration = 60;

type DbAffiliate = {
  id: string;
  full_name: string;
  email: string;
  code: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  commission_pct: number | null;
  cookie_days: number | null;
  paypal_email: string | null;
  promo_method: string | null;
  created_at: string;
};

export default async function AdminAffiliatesPage() {
  await requirePlatformSection("affiliates");
  const admin = createAdminClient();

  const [settings, { data: affiliates }, { data: clicks }, { data: referrals }, owed, { data: payouts }] = await Promise.all([
    getAffiliateSettings(admin),
    admin.from("affiliates").select("id, full_name, email, code, status, commission_pct, cookie_days, paypal_email, promo_method, created_at").order("created_at", { ascending: false }),
    admin.from("affiliate_clicks").select("affiliate_id"),
    admin.from("affiliate_referrals").select("affiliate_id"),
    owedByAffiliate(admin),
    admin.from("affiliate_payouts").select("id, affiliate_id, amount_cents, status, paypal_batch_id, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const clickCount = new Map<string, number>();
  for (const c of clicks ?? []) clickCount.set((c as { affiliate_id: string }).affiliate_id, (clickCount.get((c as { affiliate_id: string }).affiliate_id) ?? 0) + 1);
  const signupCount = new Map<string, number>();
  for (const r of referrals ?? []) signupCount.set((r as { affiliate_id: string }).affiliate_id, (signupCount.get((r as { affiliate_id: string }).affiliate_id) ?? 0) + 1);

  const rows: AffRow[] = ((affiliates ?? []) as DbAffiliate[]).map((a) => ({
    id: a.id,
    fullName: a.full_name,
    email: a.email,
    code: a.code,
    status: a.status,
    commissionPct: a.commission_pct,
    cookieDays: a.cookie_days,
    paypalEmail: a.paypal_email,
    promo: a.promo_method,
    createdAt: a.created_at,
    clicks: clickCount.get(a.id) ?? 0,
    signups: signupCount.get(a.id) ?? 0,
    owedCents: owed.get(a.id) ?? 0,
  }));

  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status !== "pending");

  const programSettings: ProgramSettings = {
    commissionPct: settings.default_commission_pct,
    termMonths: settings.default_term_months,
    cookieDays: settings.default_cookie_days,
    minPayoutDollars: Math.round(settings.min_payout_cents / 100),
  };

  const nameOf = new Map(rows.map((r) => [r.id, r.fullName || r.email]));
  const eligible: EligibleRow[] = rows
    .filter((r) => r.status === "approved" && r.paypalEmail && r.owedCents >= settings.min_payout_cents)
    .map((r) => ({ id: r.id, name: r.fullName || r.email, paypalEmail: r.paypalEmail as string, owedCents: r.owedCents }));
  const history: PayoutHistoryRow[] = ((payouts ?? []) as { id: string; affiliate_id: string; amount_cents: number; status: string; paypal_batch_id: string | null; created_at: string }[]).map((p) => ({
    id: p.id,
    name: nameOf.get(p.affiliate_id) ?? "Affiliate",
    amountCents: p.amount_cents,
    status: p.status,
    batchId: p.paypal_batch_id,
    createdAt: p.created_at,
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Affiliates</h1>
        <p className="text-base text-muted">Review applications, set commission, run payouts, and track referrals.</p>
      </div>
      <div className="flex flex-col gap-8">
        <PayoutsPanel paypalReady={paypalConfigured()} minDollars={programSettings.minPayoutDollars} eligible={eligible} history={history} />
        <AffiliatesManager settings={programSettings} pending={pending} active={active} />
      </div>
    </>
  );
}
