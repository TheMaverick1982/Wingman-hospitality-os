import type { Metadata } from "next";
import Link from "next/link";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { getPlatformPricing, dollars } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Launch Special — 20% off your first 3 months | Wingman",
  description: "Founding-operator launch offer: 20% off your first 3 months of Wingman with code LAUNCH20. Guest retention for restaurants.",
  alternates: { canonical: "/launch" },
};

const SIGNUP = "/signup?code=LAUNCH20";

const POINTS = [
  { t: "Turn first-timers into regulars", d: "The whole product points at one number: do first-time guests come back?" },
  { t: "Standards that survive the off-night", d: "Culture, role training, and shift-level accountability — portable across every location." },
  { t: "Replaces the binder, not adds to it", d: "One place for the checklists, training, and coaching your team actually uses on shift." },
];

export default async function LaunchPage() {
  const pricing = await getPlatformPricing();
  const standard = dollars(pricing.firstCents);
  const offer = dollars(Math.round((pricing.firstCents * 0.8) / 100) * 100); // 20% off, whole dollars
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-5 py-14 sm:py-20 flex flex-col items-center text-center gap-8">
        <WingmanLogo className="h-6 w-auto" />

        <div className="inline-flex items-center gap-2 rounded-full bg-brick-tint text-brick text-[13px] font-semibold px-4 py-1.5">
          🛬 Founding-operator launch offer
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-[38px] sm:text-[52px] font-bold tracking-[-0.03em] leading-[1.05]">
            20% off your first<br />3 months of Wingman
          </h1>
          <p className="text-[17px] sm:text-[19px] text-muted leading-relaxed max-w-[540px] mx-auto">
            Guest retention for restaurants — turn first-time guests into regulars, every shift. Lock in the launch rate while
            it&rsquo;s here.
          </p>
        </div>

        {/* Offer card */}
        <div className="w-full max-w-[440px] bg-white border border-line rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-[15px] text-muted-2 line-through">{standard}/mo</span>
            <span className="text-[32px] font-bold text-ink">{offer}<span className="text-[16px] text-muted font-semibold">/mo</span></span>
          </div>
          <p className="text-[13px] text-muted">first location, for your first 3 months · then standard pricing · cancel anytime</p>
          <div className="rounded-xl border border-dashed border-brick/40 bg-brick-tint/40 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">Use code at checkout</div>
            <div className="text-[22px] font-bold font-mono text-brick tracking-wide">LAUNCH20</div>
          </div>
          <Link
            href={SIGNUP}
            className="text-[17px] font-semibold text-white bg-brick rounded-full px-6 py-3.5 hover:bg-brick-dark transition-colors"
          >
            Claim the offer →
          </Link>
          <p className="text-[12px] text-muted-2">Code is pre-applied — you&rsquo;ll see it on the signup form.</p>
        </div>

        {/* Why */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-left">
          {POINTS.map((p) => (
            <div key={p.t} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[15px] font-semibold text-ink mb-1.5">{p.t}</div>
              <div className="text-[13.5px] text-muted leading-relaxed">{p.d}</div>
            </div>
          ))}
        </div>

        {/* Secondary CTAs */}
        <div className="flex flex-col items-center gap-3 mt-2">
          <p className="text-[14px] text-muted">Want to see it first?</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link href="/demo" className="text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-5 py-2.5 hover:border-brick hover:text-brick transition-colors bg-white">
              Try the live demo
            </Link>
            <Link href="/book-a-demo" className="text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-5 py-2.5 hover:border-brick hover:text-brick transition-colors bg-white">
              Book a 20-min call
            </Link>
          </div>
        </div>

        <p className="text-[12px] text-muted-2 mt-4 max-w-[460px]">
          LAUNCH20 applies 20% off your first three months. A card is required to start; standard pricing applies after the
          promo period. Cancel anytime.
        </p>
      </div>
    </main>
  );
}
