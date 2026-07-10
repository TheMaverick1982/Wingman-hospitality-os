import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAffiliateForUser,
  getAffiliateSettings,
  effectiveCommissionPct,
  effectiveCookieDays,
  referralLink,
} from "@/lib/affiliate";
import { CopyLink, SettingsForm } from "./dashboard-client";

export default async function AffiliateDashboardPage() {
  const supabase = await createClient();
  const affiliate = await getAffiliateForUser(supabase);
  if (!affiliate) redirect("/affiliates/login");

  const admin = createAdminClient();
  const settings = await getAffiliateSettings(admin);

  const name = affiliate.full_name || affiliate.email;

  if (affiliate.status !== "approved") {
    const copy =
      affiliate.status === "pending"
        ? { title: "Your application is under review", body: "Thanks for applying! We review each affiliate before their link goes live. You'll get an email as soon as you're approved." }
        : affiliate.status === "rejected"
          ? { title: "Application not approved", body: "Unfortunately your affiliate application wasn't approved at this time. If you think this is a mistake, reply to your confirmation email." }
          : { title: "Your affiliate account is paused", body: "Your affiliate account is currently suspended. Please reach out to the Wingman team for details." };
    return (
      <div className="max-w-[560px]">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-4">Hi {name.split(" ")[0]}</h1>
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B45309] bg-[#FDF3E1] px-2.5 py-1 rounded-full mb-4 capitalize">
            {affiliate.status}
          </div>
          <h2 className="text-lg font-bold text-ink mb-2">{copy.title}</h2>
          <p className="text-[15px] text-muted leading-relaxed">{copy.body}</p>
        </div>
      </div>
    );
  }

  const link = affiliate.code ? referralLink(affiliate.code) : "";
  const pct = effectiveCommissionPct(affiliate, settings);
  const [{ count: clicks }, { count: signups }] = await Promise.all([
    admin.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliate.id),
    admin.from("affiliate_referrals").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliate.id),
  ]);

  const stats = [
    { label: "Referral link clicks", value: clicks ?? 0 },
    { label: "Signups referred", value: signups ?? 0 },
    { label: "Your commission", value: `${pct}%` },
    { label: "Commission term", value: `${settings.default_term_months} mo` },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-1">Welcome back, {name.split(" ")[0]}</h1>
        <p className="text-[15px] text-muted">Share your link, and earn {pct}% of every restaurant you refer.</p>
      </div>

      {/* Referral link */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-3">Your referral link</div>
        {link ? <CopyLink link={link} /> : <p className="text-sm text-muted">Your link is being set up.</p>}
        <p className="text-[13px] text-muted-2 mt-3">
          First-click attribution, {effectiveCookieDays(affiliate, settings)}-day window. Your code:{" "}
          <span className="font-mono font-semibold text-ink">{affiliate.code}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-line rounded-2xl p-5">
            <div className="text-[26px] font-bold tracking-[-0.02em] text-ink">{s.value}</div>
            <div className="text-[13px] text-muted-2 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Earnings placeholder */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-2">Earnings</div>
        <p className="text-[15px] text-muted leading-relaxed">
          Commissions appear here once your referred restaurants become paying customers. Each commission is held until the
          customer&apos;s second successful payment, then paid to your PayPal once your balance clears the $
          {(settings.min_payout_cents / 100).toFixed(0)} minimum.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-4">Payout &amp; settings</div>
        <SettingsForm
          paypalEmail={affiliate.paypal_email ?? ""}
          cookieDays={affiliate.cookie_days}
          defaultCookieDays={settings.default_cookie_days}
        />
      </div>
    </div>
  );
}
