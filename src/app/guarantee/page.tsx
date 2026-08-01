import type { Metadata } from "next";
import Link from "next/link";
import { WingmanLogo } from "@/components/ui/wingman-logo";

// Unindexed, unlinked funnel: the "Full House Install" irresistible offer built
// around the Retention Guarantee. A private link to push in outreach — not in
// the nav, not in search. The offer is by application (a qualification call), so
// every CTA points at the demo/booking flow rather than self-serve signup.
const OG_TITLE = "Turn first-time guests into regulars in 90 days — or you stop paying until you do.";
const OG_DESC =
  "The Retention Guarantee: run Wingman as designed and your repeat-guest rate improves in 90 days, or it's free until it does.";

export const metadata: Metadata = {
  title: "The Full House Install — Wingman",
  description: "Turn first-time guests into regulars in 90 days — guaranteed, or you stop paying until you do.",
  // Keep it out of search, but let link scrapers still read the share card when
  // the private URL is pasted into a message.
  robots: { index: false, follow: false },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: "/guarantee",
    siteName: "Wingman",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
  },
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
      <path d="M20.8 5.6a4.5 4.5 0 0 0-6.4 0l-.9.9-.9-.9a4.5 4.5 0 1 0-6.4 6.4l7.3 7.3 7.3-7.3a4.5 4.5 0 0 0 0-6.4Z" />
    </svg>
  );
}
function IconManager() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </svg>
  );
}

const FLOW = [
  { icon: <IconTraining />, title: "Train the standard", sub: "Role-by-role, taught & signed off" },
  { icon: <IconAccountability />, title: "Run every shift", sub: "Checklists that hold the line" },
  { icon: <IconBounceback />, title: "Bring guests back", sub: "Win-backs & referrals, on autopilot" },
  { icon: <IconRegulars />, title: "Make regulars", sub: "First visits turn into repeat visits" },
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

// Illustrative product panel for the "four things" section — a stylized view of
// the live guarantee status, not a real customer record. Rendered on-device with
// tokens so it stays crisp and theme-safe (no screenshot to keep in sync).
const DASH_ROWS = [
  {
    icon: <IconManager />,
    title: "GMs active",
    desc: "A manager in the system at every location",
    metric: "8 / 8 locations",
    pill: "All in",
  },
  {
    icon: <IconTraining />,
    title: "Training deployed",
    desc: "Role-specific training completed & verified",
    metric: "92%",
    pill: "On track",
    progress: 92,
  },
  {
    icon: <IconAccountability />,
    title: "Accountability running",
    desc: "Shift checklists run across all locations",
    metric: "26 / 30 days",
    pill: "On track",
  },
  {
    icon: <IconBounceback />,
    title: "Bounce-back live",
    desc: "Win-back & referral engine on since week 2",
    metric: "Active",
    pill: "Live",
  },
];

function GuaranteeDashboard() {
  return (
    <div className="max-w-[680px] mx-auto rounded-2xl bg-white text-ink shadow-2xl border border-black/5 overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-paper">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-brick/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-gold/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-olive/60" />
        </span>
        <span className="flex-1 text-center text-[12.5px] font-semibold text-muted-2">Guarantee status</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-olive">
          <span className="w-1.5 h-1.5 rounded-full bg-olive animate-pulse" aria-hidden /> Live
        </span>
      </div>

      {/* summary band */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-line">
        <div>
          <div className="text-[12px] text-muted-2 font-medium">90-day guarantee window</div>
          <div className="text-[15px] font-semibold text-ink">Day 47 of 90</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-muted-2 font-medium">Requirements met</div>
          <div className="text-[22px] font-bold tracking-tight text-olive leading-none mt-0.5">4 / 4</div>
        </div>
      </div>

      {/* rows */}
      <div className="divide-y divide-line">
        {DASH_ROWS.map((r) => (
          <div key={r.title} className="flex items-center gap-3.5 px-5 sm:px-6 py-3.5">
            <span className="w-9 h-9 rounded-lg bg-brick-tint text-brick flex items-center justify-center shrink-0">
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink leading-tight">{r.title}</div>
              <div className="text-[12.5px] text-muted leading-snug truncate">{r.desc}</div>
              {typeof r.progress === "number" && (
                <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden max-w-[180px]">
                  <div className="h-full rounded-full bg-olive" style={{ width: `${r.progress}%` }} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[13px] font-semibold text-ink tabular-nums">{r.metric}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-olive-tint text-olive text-[10.5px] font-semibold px-2 py-0.5">
                <span className="w-1 h-1 rounded-full bg-olive" aria-hidden /> {r.pill}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 sm:px-6 py-2.5 bg-paper text-center text-[11px] text-muted-2 border-t border-line">
        Example view · your real locations and data
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-white px-5 sm:px-6 open:shadow-sm">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-5 [&::-webkit-details-marker]:hidden">
        <span className="text-[15.5px] sm:text-[16.5px] font-semibold text-ink leading-snug">{q}</span>
        <span
          aria-hidden
          className="shrink-0 w-6 h-6 rounded-full border border-line text-muted-2 flex items-center justify-center text-[17px] leading-none transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-6 -mt-0.5 text-[14.5px] text-muted leading-relaxed">{a}</div>
    </details>
  );
}

const FAQ_ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What exactly does “run it as designed” mean?",
    a: (
      <>
        <p>Four things — all timestamped on your dashboard from day one, so there are no judgment calls and nothing fuzzy:</p>
        <ul className="mt-2.5 flex flex-col gap-1.5 list-disc pl-5 marker:text-brick/50">
          <li><span className="text-ink font-semibold">GMs active</span> — a manager logs in at least 4× a month, at every location.</li>
          <li><span className="text-ink font-semibold">Training deployed</span> — 90%+ of assigned staff finish their role-specific training.</li>
          <li><span className="text-ink font-semibold">Accountability running</span> — shift checklists get run on at least 60 of the 90 days, at every location.</li>
          <li><span className="text-ink font-semibold">Bounce-back live</span> — your guest win-back offer runs continuously from day 15 onward.</li>
        </ul>
        <p className="mt-2.5">Miss the odd day and there&rsquo;s grace built in (below). Do these four, and the results follow — that&rsquo;s the whole trade.</p>
      </>
    ),
  },
  {
    q: "When does the 90-day clock actually start?",
    a: (
      <p>
        Not at signing. The guarantee <span className="text-ink font-semibold">activates on Day 30</span>, and only after a clean install:
        every location created, every GM logged in at least once, your training published, guest-visit data flowing from your POS, and
        shift accountability switched on everywhere. Your first 30 days (the install month) become your baseline; the 90-day measurement
        window runs Days 31&ndash;120, and you get a written result on Day 121. If a delay is on us, we extend the install window 15 days.
      </p>
    ),
  },
  {
    q: "How do you measure “repeat-guest rate”?",
    a: (
      <p>
        It&rsquo;s the share of your identified first-time guests who come back at least once within 60 days &mdash; measured across your
        <span className="text-ink font-semibold"> whole portfolio</span>, on your real connected POS/guest data, against your own baseline
        month. &ldquo;Improvement&rdquo; means a lift of at least <span className="text-ink font-semibold">2.0 percentage points</span>. It&rsquo;s
        computed automatically in the platform &mdash; not eyeballed, not from memory.
      </p>
    ),
  },
  {
    q: "What do we need in place for the guarantee to apply?",
    a: (
      <p>
        Three things: <span className="text-ink font-semibold">3+ locations</span>, a POS or guest system that can identify repeat visits,
        and enough volume to be meaningful &mdash; at least <span className="text-ink font-semibold">500 identified first-time guests</span> in
        your baseline month. Below that, the numbers are too noisy to promise against, so the performance guarantee doesn&rsquo;t apply &mdash;
        you still get the full platform and the 30-day money-back.
      </p>
    ),
  },
  {
    q: "What if we hit a rough patch mid-window?",
    a: (
      <p>
        There&rsquo;s grace built in. A location you open or acquire mid-window is exempt for its first 30 days; a location that closes drops
        out from its closing date; and accountability tolerates one 7-day gap per location for illness, an outage, or an emergency. On top of
        that, if any requirement ever dips below the line, <span className="text-ink font-semibold">we tell you in writing within 5 business
        days</span> &mdash; with the exact gap and the path back. You can&rsquo;t lose the guarantee without us flagging it first.
      </p>
    ),
  },
  {
    q: "What happens if we do everything and the number still doesn’t move?",
    a: (
      <p>
        You stop paying. We keep the full platform and support running <span className="text-ink font-semibold">free</span> until your
        repeat-guest rate hits the threshold &mdash; up to six monthly cycles. If it still hasn&rsquo;t by then, you can walk with no further
        obligation or resume at your normal rate. (The cash-back path is the 30-day window; Layer 2&rsquo;s remedy is free service, not refunds.)
      </p>
    ),
  },
  {
    q: "What would void the guarantee?",
    a: (
      <p>
        Big changes that break the measurement or the operation: selling or merging the business, migrating your POS mid-window, changing
        menu pricing more than 15% across the portfolio, rebranding or re-concepting more than a quarter of your locations, closing or
        remodeling more than a quarter of them for two weeks or more, a force-majeure event, or falling into breach (like non-payment).
        Several of these are fine if you flag them up front and we agree on an adjusted baseline in writing.
      </p>
    ),
  },
  {
    q: "Do we just have to take your word for the result?",
    a: (
      <p>
        No. Everything sits on a live dashboard for the full 120 days &mdash; you watch the four requirements and your repeat rate the whole
        time. Ask for a <span className="text-ink font-semibold">complete export of the underlying data</span> anytime and you get it. And any
        ambiguity in how a term is defined is resolved in your favor. No black box.
      </p>
    ),
  },
  {
    q: "And the 30-day money-back — any strings?",
    a: (
      <p>
        None. If it&rsquo;s not what you expected, one email or one click inside the first 30 days and we refund everything &mdash; including any
        install fee &mdash; within 5 business days. No exit interview. And you <span className="text-ink font-semibold">keep the culture and
        training system</span> we built you, permanently. Yours either way.
      </p>
    ),
  },
];

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
          <GuaranteeDashboard />
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

      {/* ---- FAQ / the fine print in plain English ---- */}
      <section className="bg-paper border-t border-line">
        <div className="max-w-[820px] mx-auto px-5 py-16 sm:py-24">
          <div className="text-center mb-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brick mb-2">Straight answers</div>
            <h2 className="font-display text-[30px] sm:text-[40px] font-bold tracking-[-0.02em]">What we expect from you — and how it&rsquo;s measured</h2>
            <p className="text-[16px] text-muted mt-3 max-w-[620px] mx-auto">
              The guarantee is a two-way deal. Here&rsquo;s exactly what your side looks like, in plain English — every number below is on
              your dashboard from day one, and the full written terms are shared before you sign.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((f) => (
              <Faq key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
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
