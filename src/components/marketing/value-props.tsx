export function ValueProps() {
  return (
    <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-32">
      <div className="max-w-[720px] mb-14 sm:mb-16">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">The system</div>
        <h2 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.05] tracking-[-0.028em] font-bold text-ink m-0">
          Guest experience isn&apos;t a poster on the wall.
        </h2>
        <h2 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.05] tracking-[-0.028em] font-bold text-muted-2 m-0">
          It&apos;s a system.
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 mb-6">
        <div className="bg-paper rounded-[28px] p-8 sm:p-12 flex flex-col justify-between min-h-[360px] sm:min-h-[420px]">
          <div>
            <div className="w-[52px] h-[52px] rounded-2xl bg-white flex items-center justify-center mb-7 shadow-sm text-brick text-2xl">↺</div>
            <h3 className="text-[26px] sm:text-[34px] leading-[1.1] tracking-[-0.02em] font-semibold text-ink mb-4 max-w-[460px]">
              Repeat guests are your most profitable ones
            </h3>
            <p className="text-base sm:text-lg text-muted leading-[1.5] max-w-[480px]">
              A guest who comes back spends more, forgives more, and tells their friends for free.
              Wingman tracks every guest&apos;s visit lifecycle — first visit through loyal regular
              — so no bounce-back opportunity slips through.
            </p>
          </div>
          <div className="flex gap-2 mt-10 flex-wrap">
            <span className="px-3.5 py-1.5 rounded-full bg-white text-[13px] font-semibold text-charcoal-2">Visit lifecycle</span>
            <span className="px-3.5 py-1.5 rounded-full bg-white text-[13px] font-semibold text-charcoal-2">Bounce-back flags</span>
          </div>
        </div>

        <div className="bg-brick rounded-[28px] p-8 sm:p-12 text-white flex flex-col justify-between min-h-[360px] sm:min-h-[420px]">
          <div className="w-[52px] h-[52px] rounded-2xl bg-white/16 flex items-center justify-center text-white text-2xl">↗</div>
          <div>
            <div className="font-display text-5xl sm:text-[64px] font-bold tracking-[-0.03em] leading-none mb-4">2×</div>
            <h3 className="text-2xl sm:text-[26px] leading-[1.15] tracking-[-0.015em] font-semibold mb-3">
              Make every marketing dollar work twice as hard
            </h3>
            <p className="text-[15px] sm:text-base text-white/82 leading-[1.5]">
              Wingman is the retention layer underneath your ad spend — turning guests you already
              paid to bring in the door into regulars who come back on their own.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-paper rounded-[28px] p-8 sm:p-11">
          <div className="w-[52px] h-[52px] rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm text-brick text-xl">◪</div>
          <h3 className="text-2xl sm:text-[26px] leading-[1.15] tracking-[-0.015em] font-semibold text-ink mb-3">
            Standards your team actually keeps
          </h3>
          <p className="text-base sm:text-lg text-muted leading-[1.5]">
            Department training, real-time sign-offs, and spot-checks that measure whether service
            felt like a transaction or an experience — so hospitality isn&apos;t left to chance,
            shift after shift.
          </p>
        </div>
        <div className="bg-paper rounded-[28px] p-8 sm:p-11">
          <div className="w-[52px] h-[52px] rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm text-brick text-xl">✦</div>
          <h3 className="text-2xl sm:text-[26px] leading-[1.15] tracking-[-0.015em] font-semibold text-ink mb-3">
            Wingman builds it, you approve it
          </h3>
          <p className="text-base sm:text-lg text-muted leading-[1.5]">
            Upload your handbook or interview guide, or answer a few questions — AI writes the
            training and hiring program for every role, hospitality-first.
          </p>
        </div>
        <div className="bg-paper rounded-[28px] p-8 sm:p-11">
          <div className="w-[52px] h-[52px] rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm text-brick text-xl">◈</div>
          <h3 className="text-2xl sm:text-[26px] leading-[1.15] tracking-[-0.015em] font-semibold text-ink mb-3">
            One system, every location
          </h3>
          <p className="text-base sm:text-lg text-muted leading-[1.5]">
            Owners see every location at a glance, and managers can be scoped to just their own
            floor. Built-in permissions mean everyone — owner, manager, or staff — sees exactly what
            they need, nothing more, nothing less.
          </p>
        </div>
      </div>
    </div>
  );
}
