const LIFECYCLE = [
  { num: "1", tag: "Hire", title: "Hire for it", body: "Interview guides and scorecards built from your values, so you screen for culture fit before day one." },
  { num: "2", tag: "Onboard", title: "Train to the standard", body: "Department-specific training for every role, with a real sign-off log — not a binder no one reads." },
  { num: "3", tag: "Daily", title: "Build daily habits", body: "Checklists and shift rituals turn the standard into muscle memory, every open and every close." },
  { num: "4", tag: "Coach", title: "Reinforce & coach", body: "Spot-checks and manager checklists catch drift early, so coaching happens in the moment." },
];

const ROLES = [
  { name: "Host", glyph: "◔", habit: "Greets within 30 seconds and sets the tone." },
  { name: "Server", glyph: "◇", habit: "Menu fluency and check-backs at the right moments." },
  { name: "Bartender", glyph: "◈", habit: "Craft standards and remembers the regulars." },
  { name: "Chef", glyph: "◪", habit: "Plate consistency, allergen discipline, ticket times." },
  { name: "Manager", glyph: "◎", habit: "Runs pre-shift and coaches on the floor." },
];

export function RoleBasedTraining() {
  return (
    <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-32">
      <div className="max-w-[760px] mb-16 sm:mb-20">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">Role-based training</div>
        <h2 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.05] tracking-[-0.028em] font-bold text-ink mb-6">
          A standard for every role, from the first interview to the closing shift.
        </h2>
        <p className="text-lg sm:text-xl text-muted leading-[1.5]">
          Wingman turns your culture into a concrete training system for each position — custom to
          your concept. It starts the moment you hire and shows up in the small daily habits
          guests actually feel.
        </p>
      </div>

      <div className="relative mb-20 sm:mb-24">
        <div
          className="hidden sm:block absolute top-[27px] left-[60px] right-[60px] h-0.5"
          style={{ background: "linear-gradient(90deg, #0A6CFF 0%, #C7DBFF 100%)" }}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {LIFECYCLE.map((p) => (
            <div key={p.num} className="text-center">
              <div className="relative z-10 w-14 h-14 rounded-full bg-white border-2 border-brick shadow-[0_4px_14px_rgba(10,108,255,0.18)] flex items-center justify-center text-xl font-bold text-brick mx-auto mb-6">
                {p.num}
              </div>
              <div className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-2 mb-2">{p.tag}</div>
              <h3 className="text-lg sm:text-[21px] leading-[1.2] tracking-[-0.01em] font-semibold text-ink mb-2.5">{p.title}</h3>
              <p className="text-sm text-muted leading-[1.5] max-w-[220px] mx-auto">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-14">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <h3 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.015em] text-ink">One path per position</h3>
          <p className="text-base text-muted max-w-[420px]">
            Every guide, checklist, and value is written in your voice — your restaurant&apos;s
            standard, not a template.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {ROLES.map((r) => (
            <div key={r.name} className="bg-paper rounded-[20px] p-6 flex flex-col gap-3.5 min-h-[180px]">
              <div className="w-10 h-10 rounded-[11px] bg-white flex items-center justify-center text-lg text-brick shadow-sm">{r.glyph}</div>
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{r.name}</div>
              <div className="text-sm text-muted leading-[1.45] mt-auto">{r.habit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
