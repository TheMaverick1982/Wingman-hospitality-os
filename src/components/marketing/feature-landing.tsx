import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { InlineCta } from "@/components/marketing/inline-cta";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");

export type FeatureLandingConfig = {
  slug: string; // e.g. "restaurant-hiring-software"
  eyebrow: string; // hero badge
  h1: string;
  subhead: string;
  heroVisual?: ReactNode; // an on-brand mock that shows what the system does
  problem: { heading: string; body: string };
  steps: { title: string; body: string }[];
  stats?: { value: string; label: string }[];
  midCta: { headline: string; sub: string };
  otherSystems: { title: string; body: string; href: string }[];
  faqs: { q: string; a: string }[];
  finalCta: { headline: string; sub: string };
};

// One shared template for the use-case / "system" landing pages. Each leads with
// a single capability (the hero) and shows the rest of Wingman below, cross-linked
// to its own page — a page per keyword cluster, all pointing at the same demo CTA.
export function FeatureLandingPage({ config }: { config: FeatureLandingConfig }) {
  const url = `${SITE}/${config.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: config.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: config.eyebrow, item: url },
        ],
      },
    ],
  };

  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav />

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-16 sm:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">{config.eyebrow}</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[72px] leading-[1.02] tracking-[-0.035em] font-bold text-ink mx-auto mb-7 max-w-[940px]">
            {config.h1}
          </h1>
          <p className="text-lg sm:text-[22px] leading-[1.5] text-muted mx-auto max-w-[640px] mb-9">{config.subhead}</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/demo" className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors">
              Try it live →
            </Link>
            <Link href="/signup" className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors">
              Get Started
            </Link>
            <Link href="/book-a-demo" className="text-[17px] font-semibold text-brick hover:text-brick-dark transition-colors px-3 py-[15px]">
              Book a Demo →
            </Link>
          </div>
          {config.heroVisual && <div className="mt-14 sm:mt-16 max-w-[900px] mx-auto text-left">{config.heroVisual}</div>}
        </div>
      </div>

      {/* Problem */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-16 sm:pt-24 pb-4">
        <div className="max-w-[760px]">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">The problem</div>
          <h2 className="font-display text-[30px] sm:text-4xl lg:text-[46px] leading-[1.08] tracking-[-0.025em] font-bold text-ink mb-5">{config.problem.heading}</h2>
          <p className="text-lg sm:text-xl text-muted leading-[1.5]">{config.problem.body}</p>
        </div>
      </div>

      {/* How this system works */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-14 sm:py-20 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {config.steps.map((s, i) => (
            <div key={s.title} className="bg-paper rounded-3xl p-8">
              <div className="w-11 h-11 rounded-[13px] bg-white flex items-center justify-center mb-6 shadow-sm text-brick text-[17px] font-bold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink mb-2.5">{s.title}</h3>
              <p className="text-[15px] text-muted leading-[1.55]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Proof */}
      {config.stats && config.stats.length > 0 && (
        <div className="bg-[#0A0A0A] text-white">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-20">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-5">
              {config.stats.map((st) => (
                <div key={st.label} className="text-center sm:text-left">
                  <div className="font-display text-4xl sm:text-5xl font-bold tracking-[-0.02em] text-[#4D97FF] mb-2">{st.value}</div>
                  <div className="text-[15px] text-[#A1A1A1] leading-[1.5]">{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <InlineCta headline={config.midCta.headline} sub={config.midCta.sub} spacingClassName="pt-16 sm:pt-24" />

      {/* The rest of Wingman */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
        <div className="max-w-[720px] mb-12">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">One platform</div>
          <h2 className="font-display text-[30px] sm:text-4xl lg:text-5xl leading-[1.08] tracking-[-0.025em] font-bold text-ink mb-5">
            It&rsquo;s one part of the whole system.
          </h2>
          <p className="text-lg sm:text-xl text-muted leading-[1.5]">
            Wingman runs the entire loop that turns first-time guests into regulars — culture, training, hiring, standards, and retention, in one place. Explore the rest:
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {config.otherSystems.map((o) => (
            <Link key={o.href} href={o.href} className="group border border-line rounded-3xl p-7 bg-white hover:border-brick/40 transition-colors">
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink mb-2 group-hover:text-brick transition-colors">{o.title}</h3>
              <p className="text-[14.5px] text-muted leading-[1.5]">{o.body}</p>
              <span className="inline-block text-[13.5px] font-semibold text-brick mt-4">Learn more →</span>
            </Link>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-paper">
        <div className="max-w-[820px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
          <h2 className="font-display text-[30px] sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-10">Frequently asked</h2>
          <div className="flex flex-col divide-y divide-line">
            {config.faqs.map((f) => (
              <div key={f.q} className="py-6 first:pt-0">
                <h3 className="text-[18px] font-semibold text-ink mb-2.5">{f.q}</h3>
                <p className="text-[16px] text-muted leading-[1.6]">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-24 sm:py-32 text-center">
        <h2 className="font-display text-4xl sm:text-5xl lg:text-[58px] leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-6 max-w-[820px] mx-auto">{config.finalCta.headline}</h2>
        <p className="text-lg sm:text-[21px] text-muted leading-[1.5] max-w-[580px] mx-auto mb-10">{config.finalCta.sub}</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/demo" className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors">
            Try it live →
          </Link>
          <Link href="/signup" className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors">
            Get Started
          </Link>
          <Link href="/book-a-demo" className="text-[17px] font-semibold text-brick hover:text-brick-dark transition-colors px-3 py-[15px]">
            Book a Demo →
          </Link>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
