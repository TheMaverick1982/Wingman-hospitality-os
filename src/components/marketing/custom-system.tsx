const YOU_TELL_US = [
  "Your concept and price point",
  "What great guest experience actually looks like at your place",
  "The #1 gap you see right now, from guests or staff",
  "Your top guest experience priorities",
  "Any signature touch or ritual you already do",
];

const WE_BUILD = [
  "A culture statement in your voice, not generic corporate language",
  "Five core values, specific to how you actually want guests treated",
  "Department-by-department training for Host, Server, Bartender, Chef, and Manager",
  "Hiring guidance matched to those same values, so you screen for the right people",
  "Accountability tools — spot-checks, daily checklists — ready to use on shift one",
];

export function CustomSystem() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-32">
        <div className="max-w-[720px] mb-14 sm:mb-16">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">Built around you</div>
          <h2 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.05] tracking-[-0.028em] font-bold text-ink mb-6">
            Not a generic training binder. Your standard.
          </h2>
          <p className="text-lg sm:text-xl text-muted leading-[1.5]">
            Every restaurant says &quot;great service&quot; means something different. Wingman asks
            a few sharp questions about yours, then builds the entire hospitality system around
            the answer.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 items-stretch">
          <div className="bg-white border border-line rounded-3xl p-8 sm:p-10">
            <p className="text-[15px] font-semibold uppercase tracking-[0.08em] text-brick mb-7">You tell us</p>
            <ul className="flex flex-col gap-[18px]">
              {YOU_TELL_US.map((item) => (
                <li key={item} className="flex items-start gap-3.5 text-base sm:text-lg text-ink leading-[1.45]">
                  <span className="w-2 h-2 rounded-full bg-brick mt-2.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0a0a0a] rounded-3xl p-8 sm:p-10 text-white">
            <p className="text-[15px] font-semibold uppercase tracking-[0.08em] text-[#6ba5ff] mb-7">We build</p>
            <ul className="flex flex-col gap-[18px]">
              {WE_BUILD.map((item) => (
                <li key={item} className="flex items-start gap-3.5 text-base sm:text-lg text-[#e5e5e5] leading-[1.45]">
                  <span className="w-5 h-5 rounded-full bg-[#10b981]/16 text-[#34d399] flex items-center justify-center text-xs shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
