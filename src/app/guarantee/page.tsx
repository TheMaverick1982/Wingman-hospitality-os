import type { Metadata } from "next";
import Link from "next/link";
import { WingmanLogo } from "@/components/ui/wingman-logo";

// Unindexed, unlinked funnel: the "Full House Install" irresistible offer built
// around the Retention Guarantee. A private link to push in outreach — not in
// the nav, not in search. The offer is by application (a qualification call), so
// every CTA points at the demo/booking flow rather than self-serve signup.
export const metadata: Metadata = {
  title: "The Full House Install — Wingman",
  description: "Turn first-time guests into regulars in 90 days — guaranteed, or you stop paying until you do.",
  robots: { index: false, follow: false },
};

const BOOK = "/book-a-demo";

function CTA({ children = "Apply for the Full House Install", small = false }: { children?: React.ReactNode; small?: boolean }) {
  return (
    <Link
      href={BOOK}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-brick text-white font-semibold hover:bg-brick-dark transition-colors ${
        small ? "text-[14px] px-6 py-3" : "text-[16px] sm:text-[17px] px-8 py-4"
      }`}
    >
      {children} <span aria-hidden>→</span>
    </Link>
  );
}

function Check() {
  return (
    <span className="mt-1 w-5 h-5 rounded-full bg-olive-tint text-olive flex items-center justify-center shrink-0 text-[12px] font-bold">✓</span>
  );
}

// Simple inline stroke icons (no external assets — theme-safe, currentColor).
const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconTraining() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </svg>
  );
}
function IconAccountability() {
  return (
    <svg {...iconProps} aria-hidden>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M9 3.5h6v3H9zM8.5 12l2 2 4-4.5" />
    </svg>
  );
}
function IconBounceback() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M3 11a8 8 0 0 1 14-5l3 3M20 4v3.5h-3.5" />
      <path d="M21 13a8 8 0 0 1-14 5l-3-3M4 20v-3.5h3.5" />
    </svg>
  );
}
function IconRegulars() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16.5 6.5l1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L13 8.8l2-.3 1-2Z" />
    </svg>
  );
}

const FLOW = [
  { icon: <IconTraining />, title: "Culture & training", sub: "A standard, taught and signed off" },
  { icon: <IconAccountability />, title: "Shift accountability", sub: "Checklists run, every shift" },
  { icon: <IconBounceback />, title: "Guest bounce-back", sub: "Win-backs & referrals, automatic" },
  { icon: <IconRegulars />, title: "More regulars", sub: "First visits become repeat visits" },
];

function FlowStrip() {
  return (
    <section className="bg-paper border-b border-line">
      <div className="max-w-[980px] mx-auto px-5 py-10 sm:py-12">
        <div className="text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-2 mb-7">
          What we install
        </div>
        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-2">
          {FLOW.map((step, i) => (
            <div key={step.title} className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2">
              <div className="flex flex-col items-center text-center gap-2 rounded-2xl bg-white border border-line px-5 py-6 w-full sm:w-[176px] shadow-sm">
                <span className="w-12 h-12 rounded-full bg-brick-tint text-brick flex items-center justify-center">
                  {step.icon}
                </span>
                <div className="text-[14.5px] font-semibold text-ink leading-tight">{step.title}</div>
                <div className="text-[12.5px] text-muted leading-snug">{step.sub}</div>
              </div>
              {i < FLOW.length - 1 && (
                <span aria-hidden className="text-brick/50 text-[20px] font-bold rotate-90 sm:rotate-0 shrink-0">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function GuaranteePage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* ---- Hero ---- */}
      <section className="border-b border-line bg-white">
        <div className="max-w-[980px] mx-auto px-5 pt-10 pb-16 sm:pt-14 sm:pb-24 flex flex-col items-center text-center gap-6">
          <WingmanLogo className="h-6 w-auto" />
          <div className="inline-flex items-center gap-2 rounded-full bg-brick-tint text-brick text-[13px] font-semibold px-4 py-1.5">
            ⭐ Founding Install · 10 groups · by application
          </div>
          <h1 className="font-display text-[40px] sm:text-[62px] font-bold tracking-[-0.03em] leading-[1.03] max-w-[760px]">
            Turn first-time guests into regulars in 90 days — or you stop paying until you do.
          </h1>
          <p className="text-[18px] sm:text-[21px] text-muted leading-relaxed max-w-[640px]">
            We install the whole system that makes guests come back — culture, training, shift accountability, and
            guest bounce-back — and we put our money where our mouth is: run it as designed and your repeat-guest rate
            improves, guaranteed. If it doesn&rsquo;t, Wingman is free until it does.
          </p>
          <div className="flex flex-col items-center gap-3 mt-2">
            <CTA />
            <span className="text-[13.5px] text-muted-2 text-center">30-day, no-questions money back · Keep your training system either way</span>
          </div>
        </div>
      </section>

      {/* ---- What we install (visual flow) ---- */}
      <FlowStrip />

      {/* ---- The stakes ---- */}
      <section className="max-w-[820px] mx-auto px-5 py-14 sm:py-20 text-center">
        <h2 className="font-display text-[28px] sm:text-[36px] font-bold tracking-[-0.02em] leading-[1.1] mb-4">
          You already paid to get them in the door. Most of them never come back — and you never find out why.
        </h2>
        <p className="text-[17px] text-muted leading-relaxed max-w-[640px] mx-auto">
          A first visit costs you ad spend, a discount, a table. A <span className="text-ink font-semibold">second</span>{" "}visit
          costs you nothing and is worth everything — it&rsquo;s where the profit lives. But the moment the owner isn&rsquo;t
          watching, the standard slips, the follow-up never happens, and the guest quietly disappears. That leak is the most
          expensive thing in your restaurant, and it&rsquo;s invisible on a P&amp;L.
        </p>
      </section>

      {/* ---- The offer stack ---- */}
      <section className="bg-white border-y border-line">
        <div className="max-w-[900px] mx-auto px-5 py-14 sm:py-20">
          <div className="text-center mb-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brick mb-2">The Full House Install</div>
            <h2 className="font-display text-[30px] sm:text-[40px] font-bold tracking-[-0.02em]">Everything that makes guests return — installed for you</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {[
              ["The whole Wingman system", "Culture, role-by-role training with real sign-offs, tests, shift accountability, hiring, and guest bounce-back — the operating system for a hospitality standard that holds."],
              ["Done-with-you install", "We build your culture and training from your own words, wire up the accountability loops, and get your GMs in — you don't do it alone."],
              ["A live guarantee dashboard", "One screen tracks the four things that make it work, in real time, for 120 days. No black box — you see exactly where you stand every day."],
              ["Guest bounce-back that runs itself", "The win-back and referral engine that turns a first visit into a second, third, and a regular — the actual mechanism behind the guarantee."],
              ["Your training system, forever", "The culture and training we build is yours to keep — exported as documents — even if you walk away on day 30."],
              ["A direct line to the team", "You're one of ten founding groups. Your feedback shapes the product, and you get real humans, not a ticket queue."],
            ].map(([t, d]) => (
              <div key={t} className="flex items-start gap-3">
                <Check />
                <div>
                  <div className="text-[15.5px] font-semibold text-ink">{t}</div>
                  <div className="text-[14px] text-muted leading-relaxed mt-0.5">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- The guarantee (risk reversal) ---- */}
      <section className="max-w-[900px] mx-auto px-5 py-16 sm:py-24">
        <div className="text-center mb-10">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brick mb-2">The guarantee</div>
          <h2 className="font-display text-[30px] sm:text-[42px] font-bold tracking-[-0.02em]">We take the risk off your table. Both of them.</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-line bg-white p-7 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2 mb-2">Layer 1 · Zero-risk trial</div>
            <div className="text-[22px] font-bold tracking-[-0.01em] mb-3">30 days, no questions.</div>
            <p className="text-[15px] text-muted leading-relaxed">
              If Wingman isn&rsquo;t what you expected, tell us within 30 days and we refund <span className="text-ink font-semibold">everything</span> —
              including any install fee. No exit interview, no save attempt. And you <span className="text-ink font-semibold">keep the culture and
              training system</span> we built you. It&rsquo;s yours either way.
            </p>
          </div>

          <div className="rounded-3xl border-2 border-brick bg-brick-tint/40 p-7 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-brick mb-2">Layer 2 · The Retention Guarantee</div>
            <div className="text-[22px] font-bold tracking-[-0.01em] mb-3">Run it as designed and your repeat-guest rate improves in 90 days.</div>
            <p className="text-[15px] text-charcoal-2 leading-relaxed">
              If it doesn&rsquo;t, <span className="text-ink font-semibold">you stop paying until it does</span> — full platform and support,
              free, until you hit the number. We only make this promise to groups who commit to actually running it, because when
              you do, it works.
            </p>
          </div>
        </div>

        <p className="text-center text-[14px] text-muted-2 mt-6 max-w-[620px] mx-auto">
          Measured on your real guest data, portfolio-wide, against your own baseline — not our word for it. Full terms and the
          exact threshold are laid out plainly before you ever sign.
        </p>
      </section>

      {/* ---- The mechanism / the four things ---- */}
      <section className="bg-ink text-white">
        <div className="max-w-[900px] mx-auto px-5 py-16 sm:py-24">
          <div className="text-center mb-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-gold mb-2">What &ldquo;as designed&rdquo; means</div>
            <h2 className="font-display text-[30px] sm:text-[40px] font-bold tracking-[-0.02em]">Four things. All tracked on your dashboard, in real time.</h2>
            <p className="text-[16px] text-white/70 mt-3 max-w-[600px] mx-auto">
              No vague &ldquo;provide good service.&rdquo; Every requirement is something the platform timestamps — so there&rsquo;s
              never anything to argue about.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["1 · Your GMs are in", "Every location has a manager actually in the system and using it — the person who makes it stick when you're not on the floor."],
              ["2 · Training is deployed", "Your team completes their role-specific training, so the standard is taught and verified — not assumed."],
              ["3 · Accountability runs", "Shift checklists get run on most days, at every location. Standards get inspected, not hoped for."],
              ["4 · Bounce-back is live", "The guest win-back engine is on and running from week two — the machine that actually moves repeat rate."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white/5 border border-white/10 p-6">
                <div className="text-[16px] font-semibold mb-1.5">{t}</div>
                <div className="text-[14px] text-white/70 leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-[15px] text-white/80 mt-8 max-w-[640px] mx-auto">
            We&rsquo;re betting on you doing those four things. Do them, and the results follow. That&rsquo;s the whole trade.
          </p>
        </div>
      </section>

      {/* ---- Qualification / status ---- */}
      <section className="max-w-[900px] mx-auto px-5 py-16 sm:py-24">
        <div className="text-center mb-10">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brick mb-2">This isn&rsquo;t for everyone</div>
          <h2 className="font-display text-[30px] sm:text-[40px] font-bold tracking-[-0.02em]">The Full House Install is for groups who&rsquo;ll actually run it.</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-olive/30 bg-olive-tint/30 p-7">
            <div className="text-[15px] font-semibold text-[#4d7c0f] mb-4">This is for you if…</div>
            <ul className="flex flex-col gap-3">
              {[
                "You run 3+ locations and want them held to one standard.",
                "You can connect a POS or guest system that identifies repeat visits.",
                "You have an ops person (or you) who'll make it stick — not just buy it.",
                "You're ready to get your GMs in and run accountability most days.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14.5px] text-charcoal-2 leading-relaxed">
                  <Check /> <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-white p-7">
            <div className="text-[15px] font-semibold text-muted-2 mb-4">It&rsquo;s not for you if…</div>
            <ul className="flex flex-col gap-3">
              {[
                "You want a binder to buy and shelve — this only pays off if it's run.",
                "Nobody on the team will own it when the owner isn't watching.",
                "You can't (or won't) get your GMs into the system.",
                "You're mid-POS-migration or a sale is in progress right now.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14.5px] text-muted leading-relaxed">
                  <span className="mt-1 w-5 h-5 rounded-full bg-paper border border-line text-muted-2 flex items-center justify-center shrink-0 text-[12px] font-bold">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 rounded-2xl bg-paper border border-line p-6 text-center">
          <p className="text-[16px] sm:text-[18px] text-ink font-semibold leading-relaxed max-w-[680px] mx-auto">
            We&rsquo;re betting on you running four things. If you won&rsquo;t commit to them, don&rsquo;t apply — you&rsquo;ll
            waste your money and our time.
          </p>
        </div>
      </section>

      {/* ---- Scarcity + final CTA ---- */}
      <section className="bg-white border-t border-line">
        <div className="max-w-[820px] mx-auto px-5 py-16 sm:py-24 text-center flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold-tint text-[#b45309] text-[13px] font-semibold px-4 py-1.5">
            Only 10 founding groups
          </div>
          <h2 className="font-display text-[30px] sm:text-[44px] font-bold tracking-[-0.02em] leading-[1.05] max-w-[680px]">
            Ten groups. Then this offer closes.
          </h2>
          <p className="text-[17px] text-muted leading-relaxed max-w-[600px]">
            A guarantee this strong takes real hands-on delivery, so we&rsquo;re taking exactly ten founding groups — the ones
            who&rsquo;ll run it and become the proof. Apply for a qualification call. If it&rsquo;s a fit, you&rsquo;re in. If it&rsquo;s
            not, we&rsquo;ll tell you straight.
          </p>
          <CTA>Apply for the Full House Install</CTA>
          <p className="text-[13.5px] text-muted-2">Backed by the 30-day, no-questions money-back guarantee.</p>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[900px] mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-muted-2">
          <div className="flex items-center gap-2"><WingmanLogo className="h-5 w-auto" /> <span>© 2026 Wingman — a The Maverick Agency company</span></div>
          <span>Guarantee subject to full written terms provided before signing.</span>
        </div>
      </footer>
    </main>
  );
}
