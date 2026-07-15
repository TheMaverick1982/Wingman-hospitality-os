import Link from "next/link";

const STEPS = [
  { num: "01", title: "Track every guest's journey", body: "Log first-time guests and the incentive that brought them back — visit by visit, across every location, shared org-wide." },
  { num: "02", title: "Catch problems before they repeat", body: "Every discount and service recovery gets a reason attached. Recurring issues surface automatically instead of hiding in a spreadsheet." },
  { num: "03", title: "Train and sign off your team", body: "Department-specific hospitality standards, technical training, and a real sign-off log — not a binder no one reads." },
  { num: "04", title: "Coach before it becomes a pattern", body: "Spot-checks, daily manager checklists, and automatic flags mean coaching happens in real time, not during a quarterly review." },
  { num: "05", title: "Grow beyond your four walls", body: "Track the local businesses around you and turn catering, group lunches, events, and fundraisers into steady, measured revenue — with follow-up alerts so no relationship goes cold." },
];

export function HowItWorks() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-32">
        <div className="max-w-[720px] mb-14 sm:mb-[72px]">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">How it works</div>
          <h2 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.05] tracking-[-0.028em] font-bold text-ink">
            From first visit to loyal regular — and beyond.
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {STEPS.map((s) => (
            <div key={s.num} className="border-t-2 border-ink pt-6">
              <div className="font-display text-4xl sm:text-[56px] font-bold tracking-[-0.03em] leading-none text-line mb-6">{s.num}</div>
              <h3 className="text-lg sm:text-[21px] leading-[1.2] tracking-[-0.01em] font-semibold text-ink mb-3">{s.title}</h3>
              <p className="text-sm text-muted leading-[1.5]">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 sm:mt-16 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <p className="text-lg sm:text-xl font-semibold tracking-[-0.015em] text-ink max-w-[420px]">
            One system for the whole journey — inside your four walls and out.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/signup"
              className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors whitespace-nowrap"
            >
              Get Started
            </Link>
            <Link
              href="/book-a-demo"
              className="text-[15px] font-semibold text-ink border border-ink/20 rounded-full px-6 py-3 hover:bg-ink/5 transition-colors whitespace-nowrap"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
