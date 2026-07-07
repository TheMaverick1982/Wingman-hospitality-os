import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

const INCLUDED = [
  "Culture wall & core values",
  "Guest Bounce Back, cross-location",
  "Service Recovery tracking",
  "Training & Standards, per role",
  "Accountability & coaching tools",
  "Hiring pipeline & scorecards",
  "Reporting & scheduled email reports",
];

export default function PricingPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MarketingNav />
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-[40px] sm:text-[56px] font-bold tracking-[-0.03em] text-ink leading-[1.05] text-balance">
            One flat price,
            <br />
            every location.
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Simple, per-location pricing. Everything Wingman does is included on both plans — you
            only pay as you grow.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mt-16 grid sm:grid-cols-2 gap-6">
          <div className="bg-panel border border-line rounded-2xl p-8 shadow-sm">
            <p className="text-sm font-semibold text-brick mb-1">Single location</p>
            <p className="text-sm text-muted mb-6">
              Everything you need to set and keep the standard at one restaurant.
            </p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-mono text-5xl font-bold text-ink">$199</span>
              <span className="text-muted">/ mo</span>
            </div>
            <p className="text-xs text-muted mb-6">per location, billed monthly</p>
            <Link
              href="/signup"
              className="block text-center text-sm font-semibold text-ink border border-line-strong rounded-full px-6 py-3 hover:bg-paper transition-colors mb-6"
            >
              Get Started
            </Link>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">Includes</p>
            <ul className="flex flex-col gap-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-charcoal-2">
                  <Check size={15} className="text-olive shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative bg-charcoal rounded-2xl p-8 shadow-md">
            <span className="absolute top-8 right-8 text-[11px] font-semibold uppercase tracking-wide text-white bg-brick rounded-full px-3 py-1">
              Most popular
            </span>
            <p className="text-sm font-semibold text-brick-dark mb-1">Multi-location</p>
            <p className="text-sm text-[#a1a1a1] mb-6 pr-20">
              One consistent standard across every restaurant, with GM oversight built in.
            </p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-mono text-5xl font-bold text-white">$199</span>
              <span className="text-[#a1a1a1]">/ mo</span>
            </div>
            <p className="text-sm text-[#a1a1a1] mb-1">for your first location, then</p>
            <p className="text-sm mb-6">
              <span className="font-mono text-lg font-semibold text-brick-dark">+$100</span>
              <span className="text-[#a1a1a1]"> per additional location / mo</span>
            </p>
            <Link
              href="/signup"
              className="block text-center text-sm font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors mb-6"
            >
              Get Started
            </Link>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a1a1a1] mb-4">Includes</p>
            <ul className="flex flex-col gap-2.5">
              {[...INCLUDED, "Cross-location benchmarking"].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#f5f5f5]">
                  <Check size={15} className="text-brick-dark shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-sm text-muted mt-10">
          Adding a location later? It&apos;s added to your subscription automatically, prorated for the
          rest of the billing cycle.
        </p>
      </section>
      <MarketingFooter />
    </div>
  );
}
