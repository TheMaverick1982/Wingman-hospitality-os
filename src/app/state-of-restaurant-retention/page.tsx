import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

const SITE = "https://www.joinwingman.app";
const UPDATED = "August 2026";

export const metadata: Metadata = {
  title: "The State of Restaurant Guest Retention (2026)",
  description:
    "Why the money is in the second visit. A plain-English breakdown of restaurant guest-retention economics — what a repeat-rate point is worth, and the four things that decide whether first-timers become regulars.",
  keywords: [
    "restaurant guest retention",
    "restaurant repeat customer rate",
    "restaurant retention statistics",
    "restaurant customer retention benchmarks",
    "repeat customer revenue restaurant",
  ],
  alternates: { canonical: "/state-of-restaurant-retention" },
  openGraph: {
    type: "article",
    title: "The State of Restaurant Guest Retention (2026)",
    description: "Why the money is in the second visit — and what separates restaurants that earn it.",
    url: "/state-of-restaurant-retention",
  },
};

// Illustrative retention-economics model — the SAME math as the public
// calculator, for a representative independent restaurant. Clearly labelled as a
// model on the page (not a claim about any specific operator's results).
const MODEL = { guestsPerMonth: 400, check: 35, visitsPerYear: 6, base: 25 };
function addedRevenue(targetPct: number): number {
  const lift = Math.max(0, targetPct - MODEL.base) / 100;
  const extraRegulars = MODEL.guestsPerMonth * 12 * lift;
  return Math.round(extraRegulars * (MODEL.visitsPerYear - 1) * MODEL.check);
}
const SCENARIOS = [30, 35, 40].map((t) => ({ target: t, revenue: addedRevenue(t) }));
const MAX_REV = Math.max(...SCENARIOS.map((s) => s.revenue));
const usd = (n: number) => `$${n.toLocaleString()}`;

const PILLARS = [
  { title: "Culture", body: "A written standard and values the team can recite. Retention is a team sport before it's a tactic — people deliver an experience they actually believe in." },
  { title: "Training", body: "Every role has a clear, checkable standard for the shift. Consistency is what turns a good night into a good habit, and a habit into a reputation." },
  { title: "Accountability", body: "Managers inspect what they expect — spot-checks, pre-shift focus, coaching. Standards slip the moment nobody's looking; a cadence keeps them up." },
  { title: "Bounce-back", body: "A deliberate way to turn a first-timer into a second visit — logging who came, giving them a reason to return, and following up. Most restaurants leave this to luck." },
];

const BENCHMARKS = [
  "They know their repeat/return rate and watch the trend — you can't grow what you don't measure.",
  "First-time guests are logged, with a deliberate nudge to come back.",
  "Every role has written standards the team is actually held to.",
  "There's a set service-recovery process, so a bad moment gets made right instead of lost.",
  "New hires are screened for hospitality attitude, not just experience.",
  "Pre-shift meetings carry one specific guest-experience focus.",
];

const FAQ = [
  {
    q: "What is a good repeat-customer rate for a restaurant?",
    a: "It varies widely by concept and daypart, so the number that matters is your own trend — measured consistently month over month. The leverage point is less the absolute rate and more the improvement: even a few points of lift in the share of first-timers who come back compounds into meaningful annual revenue, because a regular visits many times a year.",
  },
  {
    q: "Why does guest retention matter more than acquisition?",
    a: "Because the second visit is where the economics turn. Landmark research by Bain & Company (Fred Reichheld) found that increasing customer retention by 5% can raise profits anywhere from 25% to 95%. For restaurants specifically, the lever is converting first-timers into regulars — a regular's repeated visits are worth many times a single new-guest visit.",
  },
  {
    q: "How do you improve restaurant guest retention?",
    a: "Treat it as a system, not a promotion. In practice it comes down to four things: a culture the team believes in, clear role training, real accountability so standards hold, and a deliberate bounce-back process that turns first-timers into second visits.",
  },
];

export default function StateOfRetentionPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "The State of Restaurant Guest Retention (2026)",
        description: "Why the money is in the second visit — and what separates restaurants that earn it.",
        author: { "@type": "Organization", name: "Wingman" },
        publisher: { "@type": "Organization", name: "Wingman", url: SITE },
        mainEntityOfPage: `${SITE}/state-of-restaurant-retention`,
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="flex-1 flex flex-col force-light bg-paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav />

      {/* Hero */}
      <header style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[860px] mx-auto px-6 sm:px-10 pt-16 sm:pt-20 pb-12">
          <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-brick mb-4">Wingman Report · Updated {UPDATED}</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[60px] leading-[1.03] tracking-[-0.03em] font-bold text-ink mb-6">
            The State of Restaurant Guest Retention
          </h1>
          <p className="text-lg sm:text-[21px] leading-[1.5] text-muted max-w-[640px]">
            Every restaurant fights for the first visit. The money is in the second. Here&rsquo;s the plain-English
            economics of guest retention — what a single repeat-rate point is worth, and the four things that decide
            whether a first-timer ever comes back.
          </p>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-6 sm:px-10 py-14 sm:py-16 flex flex-col gap-16">
        {/* The thesis */}
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-ink mb-4">Retention beats acquisition — and it isn&rsquo;t close</h2>
          <p className="text-[17px] leading-[1.65] text-charcoal-2 mb-4">
            The most-cited finding in all of loyalty research comes from Bain &amp; Company&rsquo;s Fred Reichheld:
            increasing customer retention by just <strong>5%</strong> can increase profit by <strong>25% to 95%</strong>.
            The reason is simple — you&rsquo;ve already paid to acquire the guest; every visit after the first is almost
            pure upside.
          </p>
          <p className="text-[17px] leading-[1.65] text-charcoal-2">
            For restaurants the lever is specific: <strong>turning first-timers into regulars</strong>. A one-time guest
            is a single check. A regular is that check multiplied across a year. Which means small improvements in the
            share of first-timers who return compound into real money — fast.
          </p>
        </section>

        {/* The math */}
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-ink mb-4">What one repeat-rate point is worth</h2>
          <p className="text-[17px] leading-[1.65] text-charcoal-2 mb-6">
            Take a representative independent restaurant: <strong>{MODEL.guestsPerMonth} new guests a month</strong>, a{" "}
            <strong>{usd(MODEL.check)} average check</strong>, and a regular who visits <strong>{MODEL.visitsPerYear}×
            a year</strong>. Here&rsquo;s the annual revenue added by lifting the repeat rate from today&rsquo;s{" "}
            {MODEL.base}%:
          </p>

          <div className="bg-white border border-line rounded-[22px] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-5">
              {SCENARIOS.map((s) => (
                <div key={s.target}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[15px] font-semibold text-ink">{MODEL.base}% → {s.target}% repeat rate</span>
                    <span className="text-[17px] font-bold text-ink tabular-nums">+{usd(s.revenue)}/yr</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#F1F1F1] overflow-hidden">
                    <div className="h-full rounded-full bg-brick" style={{ width: `${Math.round((s.revenue / MAX_REV) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-muted-2 mt-6">
              Illustrative model, using the same math as our{" "}
              <a href="/calculator" className="font-semibold text-brick hover:text-brick-dark">free calculator</a> — the
              added revenue is the value of the extra visits from first-timers converted into regulars. Run your own
              numbers to see your figure.
            </p>
          </div>
        </section>

        {/* The four pillars */}
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-ink mb-4">The four things that decide it</h2>
          <p className="text-[17px] leading-[1.65] text-charcoal-2 mb-6">
            Retention isn&rsquo;t a promotion you run; it&rsquo;s a system you operate. Across the restaurants that do it
            well, the same four pillars show up — and the ones that struggle are usually missing two or three.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {PILLARS.map((p, i) => (
              <div key={p.title} className="bg-white border border-line rounded-2xl p-6 shadow-sm">
                <div className="text-[13px] font-bold text-brick mb-1.5 tabular-nums">0{i + 1}</div>
                <div className="text-[17px] font-semibold text-ink mb-1.5">{p.title}</div>
                <p className="text-[14.5px] leading-[1.55] text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benchmarks */}
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-ink mb-4">What strong operators do</h2>
          <p className="text-[17px] leading-[1.65] text-charcoal-2 mb-6">
            Retention rarely comes down to one big move — it&rsquo;s a set of small standards, held consistently. The
            restaurants with the healthiest repeat rates tend to check every one of these boxes:
          </p>
          <ul className="flex flex-col gap-3">
            {BENCHMARKS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[16px] leading-[1.5] text-charcoal-2">
                <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="text-[15px] text-muted mt-6">
            Want to see where you stand? The{" "}
            <a href="/scorecard" className="font-semibold text-brick hover:text-brick-dark">free 2-minute Hospitality Scorecard</a>{" "}
            grades your operation against these and hands you your three biggest gaps.
          </p>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-ink mb-6">Questions operators ask</h2>
          <div className="flex flex-col gap-5">
            {FAQ.map((f) => (
              <div key={f.q} className="bg-white border border-line rounded-2xl p-6 shadow-sm">
                <div className="text-[17px] font-semibold text-ink mb-2">{f.q}</div>
                <p className="text-[15px] leading-[1.6] text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sources / methodology */}
        <section className="border-t border-line pt-8">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-3">Sources &amp; method</h3>
          <ul className="flex flex-col gap-2 text-[13.5px] text-muted leading-[1.5]">
            <li>Retention-to-profit figure: Bain &amp; Company / Fred Reichheld, widely cited in <em>Harvard Business Review</em>.</li>
            <li>Revenue model: Wingman&rsquo;s own repeat-rate leverage formula (added regulars × extra visits × average check), shown as an illustrative example, not a claim about any specific restaurant&rsquo;s results.</li>
            <li>The four pillars and operator benchmarks reflect Wingman&rsquo;s operating framework, drawn from how the strongest hospitality teams run.</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center bg-[#0A0A0A] rounded-[24px] px-6 py-12 sm:py-14">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-white mb-4">Turn the second visit into a system.</h2>
          <p className="text-[17px] text-white/70 leading-[1.5] max-w-[520px] mx-auto mb-8">
            Wingman builds the culture, training, accountability, and bounce-back that keep guests coming back — live on
            your first shift.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="/signup" className="text-[16px] font-semibold text-white bg-brick rounded-full px-7 py-3.5 hover:bg-brick-dark transition-colors">Get Started</a>
            <a href="/calculator" className="text-[16px] font-semibold text-white/90 hover:text-white">Try the calculator →</a>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
