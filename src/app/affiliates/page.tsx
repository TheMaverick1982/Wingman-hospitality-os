import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAffiliateSettings } from "@/lib/affiliate";
import { AffiliateApplyForm } from "./apply-form";

// Reads live program settings per request (via the service-role client), so it
// must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Affiliate Program",
  description:
    "Earn recurring commission for every restaurant you refer to Wingman. Share your link, we handle the rest, and you get paid via PayPal.",
  keywords: ["wingman affiliate", "restaurant software affiliate program", "referral program", "recurring commission"],
  alternates: { canonical: "/affiliates" },
  openGraph: {
    title: "Affiliate Program | Wingman",
    description: "Earn recurring commission for every restaurant you refer.",
    url: "/affiliates",
  },
};

export default async function AffiliatesPage() {
  const admin = createAdminClient();
  const s = await getAffiliateSettings(admin);

  const steps = [
    { n: "1", title: "Share your link", body: "Get a unique referral link the moment you're approved. Share it anywhere restaurant operators are." },
    { n: "2", title: "They sign up", body: `We track your referral for ${s.default_cookie_days} days. If they come from two affiliates, the first one wins.` },
    { n: "3", title: "You get paid", body: `Earn ${s.default_commission_pct}% of their subscription every month for ${s.default_term_months} months, paid to your PayPal.` },
  ];

  const reasons = [
    "Recurring commission — not a one-time bounty.",
    "First-click attribution, so your referral is protected.",
    "A real dashboard: clicks, signups, and earnings.",
    "Get paid straight to PayPal once approved commissions clear.",
  ];

  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-16 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">Affiliate Program</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[76px] leading-[1.0] tracking-[-0.035em] font-bold text-ink mx-auto mb-6 max-w-[860px]">
            Refer restaurants. Earn every month.
          </h1>
          <p className="text-lg sm:text-[22px] leading-[1.5] text-muted mx-auto max-w-[600px] mb-9">
            Earn <strong className="text-ink">{s.default_commission_pct}% recurring commission</strong> for every restaurant
            you bring to Wingman — for {s.default_term_months} months, paid to your PayPal.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="#apply"
              className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors"
            >
              Become an affiliate
            </a>
            <Link
              href="/affiliates/login"
              className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors"
            >
              Affiliate login
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-24 w-full">
        <h2 className="text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-12 text-center">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {steps.map((st) => (
            <div key={st.n} className="bg-white border border-line rounded-[22px] p-8">
              <div className="w-9 h-9 rounded-full bg-brick text-white flex items-center justify-center font-bold mb-5">{st.n}</div>
              <h3 className="text-xl font-bold text-ink mb-2">{st.title}</h3>
              <p className="text-[15px] text-muted leading-[1.55]">{st.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why + apply */}
      <div className="bg-paper">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-6">
              Why partner with Wingman
            </h2>
            <div className="flex flex-col gap-3.5">
              {reasons.map((r) => (
                <div key={r} className="flex gap-3 items-start">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brick-tint text-brick flex items-center justify-center text-xs mt-px">✓</span>
                  <span className="text-[16px] text-ink leading-[1.45]">{r}</span>
                </div>
              ))}
            </div>
            <p className="text-[14px] text-muted-2 leading-[1.55] mt-7">
              Applications are reviewed before your link goes live. Commissions are held until the customer&apos;s second
              successful payment, then paid to PayPal once your balance clears the ${(s.min_payout_cents / 100).toFixed(0)} minimum.
            </p>
          </div>

          <div id="apply" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-ink mb-4">Apply to become an affiliate</h2>
            <AffiliateApplyForm />
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
