import type { Metadata } from "next";
import Link from "next/link";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { getPlatformPricing, dollars } from "@/lib/pricing";
import { validateCoupon, describeCoupon } from "@/lib/coupons";

const FOUNDER_CODE = "FOUNDER50";

// Reads the live coupon + pricing, so render per-request (not at build time).
export const dynamic = "force-dynamic";

// Unindexed founders landing page — a private link with a special founders
// price, driven by the FOUNDER50 coupon so the discount is easy to change.
export const metadata: Metadata = {
  title: "Founders",
  robots: { index: false, follow: false },
};

function discounted(firstCents: number, coupon: { percent_off: number | null; amount_off_cents: number | null }): number {
  if (coupon.percent_off != null) return Math.max(0, Math.round((firstCents * (100 - coupon.percent_off)) / 100));
  if (coupon.amount_off_cents != null) return Math.max(0, firstCents - coupon.amount_off_cents);
  return firstCents;
}

export default async function FoundersPage() {
  const pricing = await getPlatformPricing();
  const { coupon } = await validateCoupon(FOUNDER_CODE);
  const standard = dollars(pricing.firstCents);
  const founderCents = coupon ? discounted(pricing.firstCents, coupon) : pricing.firstCents;
  const founderPrice = dollars(founderCents);
  const terms = coupon ? describeCoupon(coupon) : "special founders pricing";
  const signup = `/signup?code=${FOUNDER_CODE}`;

  const PERKS = [
    "Everything in Wingman, every plan — culture, training, tests, accountability, hiring, and retention tracking.",
    "Direct line to the team while we build — your feedback shapes the roadmap.",
    "Lock in the founders rate for as long as you stay.",
  ];

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-5 py-14 sm:py-20 flex flex-col items-center text-center gap-8">
        <WingmanLogo className="h-6 w-auto" />

        <div className="inline-flex items-center gap-2 rounded-full bg-brick-tint text-brick text-[13px] font-semibold px-4 py-1.5">
          ⭐ Founders invitation
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-[38px] sm:text-[52px] font-bold tracking-[-0.03em] leading-[1.05]">
            Be a Wingman founder
          </h1>
          <p className="text-[17px] sm:text-[19px] text-muted leading-relaxed max-w-[540px] mx-auto">
            A private invite for the first operators building with us. Turn first-time guests into regulars, every
            shift — at the founders rate.
          </p>
        </div>

        {/* Offer card */}
        <div className="w-full max-w-[440px] bg-white border border-line rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-[15px] text-muted-2 line-through">{standard}/mo</span>
            <span className="text-[32px] font-bold text-ink">{founderPrice}<span className="text-[16px] text-muted font-semibold">/mo</span></span>
          </div>
          <p className="text-[13px] text-muted">first location · {terms} · then standard pricing · cancel anytime</p>
          <div className="rounded-xl border border-dashed border-brick/40 bg-brick-tint/40 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">Use code at checkout</div>
            <div className="text-[22px] font-bold font-mono text-brick tracking-wide">{FOUNDER_CODE}</div>
          </div>
          <Link
            href={signup}
            className="text-[17px] font-semibold text-white bg-brick rounded-full px-6 py-3.5 hover:bg-brick-dark transition-colors"
          >
            Claim your founders spot →
          </Link>
          <p className="text-[12px] text-muted-2">Code is pre-applied — you&rsquo;ll see it on the signup form.</p>
        </div>

        <div className="w-full max-w-[440px] flex flex-col gap-3 text-left">
          {PERKS.map((p) => (
            <div key={p} className="flex gap-3 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brick-tint text-brick flex items-center justify-center text-xs mt-px">✓</span>
              <span className="text-[15px] text-charcoal-2 leading-[1.45]">{p}</span>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-muted-2 max-w-[440px]">
          {FOUNDER_CODE} applies {terms} to your first location. A card is required to start; standard pricing applies
          after. Billed by The Maverick Agency.
        </p>
      </div>
    </main>
  );
}
