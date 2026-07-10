import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAffiliateSettings } from "@/lib/affiliate";
import { AffiliatesManager, type AffRow, type ProgramSettings } from "./affiliates-manager";

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

  const [settings, { data: affiliates }, { data: clicks }, { data: referrals }] = await Promise.all([
    getAffiliateSettings(admin),
    admin.from("affiliates").select("id, full_name, email, code, status, commission_pct, cookie_days, paypal_email, promo_method, created_at").order("created_at", { ascending: false }),
    admin.from("affiliate_clicks").select("affiliate_id"),
    admin.from("affiliate_referrals").select("affiliate_id"),
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
  }));

  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status !== "pending");

  const programSettings: ProgramSettings = {
    commissionPct: settings.default_commission_pct,
    termMonths: settings.default_term_months,
    cookieDays: settings.default_cookie_days,
    minPayoutDollars: Math.round(settings.min_payout_cents / 100),
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Affiliates</h1>
        <p className="text-base text-muted">Review applications, set commission, and track referrals.</p>
      </div>
      <AffiliatesManager settings={programSettings} pending={pending} active={active} />
    </>
  );
}
