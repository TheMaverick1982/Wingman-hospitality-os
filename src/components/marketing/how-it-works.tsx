const STEPS = [
  { num: "01", title: "Track every guest's journey", body: "Log first-time guests and the incentive that brought them back — visit by visit, across every location, shared org-wide." },
  { num: "02", title: "Catch problems before they repeat", body: "Every discount and service recovery gets a reason attached. Recurring issues surface automatically instead of hiding in a spreadsheet." },
  { num: "03", title: "Train and sign off your team", body: "Department-specific hospitality standards, technical training, and a real sign-off log — not a binder no one reads." },
  { num: "04", title: "Coach before it becomes a pattern", body: "Spot-checks, daily manager checklists, and automatic flags mean coaching happens in real time, not during a quarterly review." },
];

export function HowItWorks() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-32">
        <div className="max-w-[720px] mb-14 sm:mb-[72px]">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">How it works</div>
          <h2 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.05] tracking-[-0.028em] font-bold text-ink">
            From first visit to loyal regular.
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {STEPS.map((s) => (
            <div key={s.num} className="border-t-2 border-ink pt-6">
              <div className="font-display text-4xl sm:text-[56px] font-bold tracking-[-0.03em] leading-none text-line mb-6">{s.num}</div>
              <h3 className="text-lg sm:text-[21px] leading-[1.2] tracking-[-0.01em] font-semibold text-ink mb-3">{s.title}</h3>
              <p className="text-sm text-muted leading-[1.5]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
