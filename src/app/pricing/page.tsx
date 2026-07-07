import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, per-location pricing for Wingman: $199/mo for your first location, $100/mo for each additional one. Culture, training, accountability, and retention tracking included on every plan.",
  keywords: [
    "restaurant software pricing",
    "hospitality management software cost",
    "multi-location restaurant pricing",
    "guest retention software pricing",
  ],
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Wingman",
    description: "One standard, every location. Simple per-location pricing with everything included.",
    url: "/pricing",
  },
};

const SINGLE = [
  "Custom culture statement and five core values",
  "Role-based training for every position",
  "Real-time sign-off log",
  "Daily checklists and pre-shift rituals",
  "Manager spot-checks and coaching flags",
  "Guest visit tracking and retention reports",
];

const MULTI = [
  "Unlimited locations, one shared standard",
  "Super Admin view across every location",
  "Per-location permissions for Managers",
  "Cross-location trends and benchmarking",
  "Roll out training and checklists group-wide",
];

const EXAMPLES = [
  { count: "1 location", price: "$199", math: "base plan" },
  { count: "3 locations", price: "$399", math: "$199 + 2 × $100" },
  { count: "5 locations", price: "$599", math: "$199 + 4 × $100" },
];

const FAQS = [
  {
    q: "What counts as a location?",
    a: "Each physical restaurant with its own floor and team. The first is $199/mo; every additional location adds $100/mo.",
  },
  {
    q: "Is everything included on both plans?",
    a: "Yes. Culture, training, accountability, and retention tracking are on every plan. Multi-location adds Super Admin oversight, permissions, and cross-location reporting.",
  },
  {
    q: "Do I have to commit up front?",
    a: "No. Plans are billed monthly and you can add or remove locations as your group changes.",
  },
  {
    q: "How fast can we start?",
    a: "You answer a few questions about your concept, Wingman builds your standard, and your team can be live on the first shift.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PricingPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <MarketingNav />

      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-16 sm:pb-[72px] text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">Pricing</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[80px] leading-[1.0] tracking-[-0.035em] font-bold text-ink mx-auto mb-6 max-w-[900px]">
            One standard. Every location.
          </h1>
          <p className="text-lg sm:text-[22px] leading-[1.5] text-muted mx-auto max-w-[560px]">
            Simple, per-location pricing. Everything Wingman does is included on both plans — you
            only pay as you grow.
          </p>
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10 -translate-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="bg-white border border-line rounded-[28px] p-8 sm:p-11 flex flex-col shadow-md">
              <div className="text-[15px] font-bold tracking-[-0.01em] text-brick mb-2">Single location</div>
              <p className="text-[15px] text-muted leading-[1.45] mb-7">
                Everything you need to set and keep the standard at one restaurant.
              </p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-5xl sm:text-[64px] font-bold tracking-[-0.03em] leading-none text-ink">$199</span>
                <span className="text-lg text-muted font-medium">/ mo</span>
              </div>
              <div className="text-sm text-muted-2 mb-8">per location, billed monthly</div>
              <Link
                href="/signup"
                className="mb-8 text-center text-base font-semibold text-ink bg-white border border-line-strong rounded-full px-6 py-3.5 hover:bg-paper hover:border-muted-2 transition-colors"
              >
                Get Started
              </Link>
              <div className="text-[13px] font-semibold tracking-[0.06em] uppercase text-muted-2 mb-[18px]">
                Includes
              </div>
              <div className="flex flex-col gap-3.5">
                {SINGLE.map((f) => (
                  <div key={f} className="flex gap-3 items-start">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-brick-tint text-brick flex items-center justify-center text-xs mt-px">
                      ✓
                    </span>
                    <span className="text-[15px] text-ink leading-[1.45]">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative bg-[#0A0A0A] rounded-[28px] p-8 sm:p-11 flex flex-col text-white shadow-2xl">
              <span className="absolute top-7 right-7 bg-brick text-white text-xs font-bold tracking-[0.04em] uppercase px-3 py-1.5 rounded-full">
                Most popular
              </span>
              <div className="text-[15px] font-bold tracking-[-0.01em] text-[#4D97FF] mb-2">Multi-location</div>
              <p className="text-[15px] text-[#A1A1A1] leading-[1.45] mb-7 max-w-[320px]">
                One consistent standard across every restaurant, with Super Admin oversight built
                in.
              </p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-5xl sm:text-[64px] font-bold tracking-[-0.03em] leading-none">$199</span>
                <span className="text-lg text-[#A1A1A1] font-medium">/ mo</span>
              </div>
              <div className="text-[15px] text-[#E5E5E5] mb-1.5">for your first location, then</div>
              <div className="flex items-baseline gap-1.5 mb-8">
                <span className="text-2xl font-bold tracking-[-0.02em] text-[#4D97FF]">+$100</span>
                <span className="text-[15px] text-[#A1A1A1]">per additional location / mo</span>
              </div>
              <Link
                href="/signup"
                className="mb-8 text-center text-base font-semibold text-white bg-brick rounded-full px-6 py-3.5 hover:bg-brick-dark transition-colors"
              >
                Get Started
              </Link>
              <div className="text-[13px] font-semibold tracking-[0.06em] uppercase text-muted mb-[18px]">
                Everything in Single, plus
              </div>
              <div className="flex flex-col gap-3.5">
                {MULTI.map((f) => (
                  <div key={f} className="flex gap-3 items-start">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#4D97FF]/18 text-[#4D97FF] flex items-center justify-center text-xs mt-px">
                      ✓
                    </span>
                    <span className="text-[15px] text-[#E5E5E5] leading-[1.45]">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-14 sm:pt-8 pb-20 sm:pb-28">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-3">
            What you&apos;d pay
          </h2>
          <p className="text-[17px] text-muted">
            The first location is $199/mo. Each one after that adds $100/mo.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-[900px] mx-auto">
          {EXAMPLES.map((e) => (
            <div key={e.count} className="border border-line rounded-[20px] p-8 text-center">
              <div className="text-[15px] font-semibold text-muted mb-4">{e.count}</div>
              <div className="flex items-baseline justify-center gap-1.5 mb-2">
                <span className="text-[44px] font-bold tracking-[-0.02em] leading-none text-ink">{e.price}</span>
                <span className="text-base text-muted-2">/ mo</span>
              </div>
              <div className="text-sm text-muted-2">{e.math}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[820px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
          <h2 className="text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-10 sm:mb-12 text-center">
            Questions, answered
          </h2>
          <div className="flex flex-col gap-2">
            {FAQS.map((f) => (
              <div key={f.q} className="bg-white border border-line rounded-[18px] px-7 py-6">
                <div className="text-lg font-semibold tracking-[-0.01em] text-ink mb-2">{f.q}</div>
                <div className="text-base text-muted leading-[1.55]">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-24 sm:py-32 text-center">
        <h2 className="font-display text-4xl sm:text-5xl lg:text-[60px] leading-[1.04] tracking-[-0.03em] font-bold text-ink mb-6">
          Set the standard.
          <br />
          Then keep it.
        </h2>
        <p className="text-lg sm:text-[21px] text-muted leading-[1.5] max-w-[540px] mx-auto mb-10">
          Start with one location or your whole group — live on your first shift.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/book-a-demo"
            className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors"
          >
            Book a Demo
          </Link>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
