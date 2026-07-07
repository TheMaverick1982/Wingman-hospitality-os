const STEPS = [
  {
    n: "01",
    title: "Track every guest's journey",
    body: "Log first-time guests and the incentive that brought them back — visit by visit, across every location, shared org-wide.",
  },
  {
    n: "02",
    title: "Catch problems before they repeat",
    body: "Every discount and service recovery gets a reason attached. Recurring issues surface automatically instead of hiding in a spreadsheet.",
  },
  {
    n: "03",
    title: "Train and sign off your team",
    body: "Department-specific hospitality standards, technical training, and a real sign-off log — not a binder no one reads.",
  },
  {
    n: "04",
    title: "Coach before it becomes a pattern",
    body: "Spot-checks, daily manager checklists, and automatic flags mean coaching happens in real time, not during a quarterly review.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-panel py-24 px-6 border-t border-line">
      <div className="max-w-[1180px] mx-auto">
        <h2 className="font-display text-[30px] font-bold text-center text-ink mb-16 tracking-tight">
          How it works
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-mono text-sm text-muted mb-3">{s.n}</div>
              <h3 className="text-[17px] font-semibold text-ink mb-2">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
