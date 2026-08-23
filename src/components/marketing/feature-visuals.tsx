// Static, on-brand mock UIs for the feature landing-page heroes — they show what
// each system actually does, in the same visual language as the rest of the
// marketing site (white cards, paper backgrounds, brick accents). No client JS.

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "text-[#F5A623]" : "text-line-strong"}>★</span>
      ))}
    </span>
  );
}

// HIRING — an applicant card with an AI screening tier + scores.
export function HiringVisual() {
  return (
    <div className="bg-white border border-line rounded-3xl p-6 sm:p-7 shadow-md">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-paper text-muted flex items-center justify-center text-sm font-bold">MR</span>
          <div>
            <div className="text-[15px] font-bold text-ink">Maria Reyes</div>
            <div className="text-[12.5px] text-muted-2">Server · applied via Craigslist</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[#E7F6EC] text-[#15803D]">
          <span className="w-1.5 h-1.5 rounded-full bg-current" /> Strong fit
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-paper rounded-2xl p-4">
          <div className="text-[12px] text-muted-2 font-medium mb-1">Guest-experience instinct</div>
          <div className="text-[22px] font-bold text-ink tabular-nums">5<span className="text-muted-2 text-[15px]">/5</span></div>
        </div>
        <div className="bg-paper rounded-2xl p-4">
          <div className="text-[12px] text-muted-2 font-medium mb-1">Follows instructions</div>
          <div className="text-[22px] font-bold text-ink tabular-nums">4<span className="text-muted-2 text-[15px]">/5</span></div>
        </div>
      </div>
      <div className="rounded-2xl border border-brick/20 bg-brick-tint/25 p-3.5 text-[13px] text-charcoal-2 leading-[1.5]">
        <span className="font-semibold text-brick-dark">Wingman&rsquo;s read:</span> Warm, specific answers and clearly reads the guest. Worth an interview.
      </div>
    </div>
  );
}

// RETENTION — the guest journey, first visit to loyal regular.
export function RetentionVisual() {
  const steps = [
    { v: "Visit 1", t: "First-timer logged", done: true },
    { v: "Visit 2", t: "Bounce-back", done: true },
    { v: "Visit 3", t: "Becoming a regular", done: true },
    { v: "Visit 4+", t: "Loyal regular", done: false },
  ];
  return (
    <div className="bg-white border border-line rounded-3xl p-6 sm:p-7 shadow-md">
      <div className="flex items-center justify-between mb-5">
        <div className="text-[15px] font-semibold text-ink">Guest journey · Downtown</div>
        <span className="text-[12px] font-semibold text-[#15803D] bg-[#E7F6EC] px-2.5 py-1 rounded-full">Repeat rate ↑ 6.2%</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {steps.map((s) => (
          <div key={s.v} className={`rounded-2xl p-4 border ${s.done ? "border-brick/25 bg-brick-tint/20" : "border-dashed border-line-strong bg-paper"}`}>
            <div className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-brick mb-2">{s.v}</div>
            <div className="text-[13.5px] font-semibold text-ink leading-[1.35]">{s.t}</div>
            <div className={`mt-3 w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${s.done ? "bg-brick text-white" : "border-2 border-line-strong text-transparent"}`}>✓</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// TRAINING — a learn-then-quiz question with the right answer + progress.
export function TrainingVisual() {
  return (
    <div className="bg-white border border-line rounded-3xl p-6 sm:p-7 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[14px] font-semibold text-ink">Food Test · Day 2 of 5</span>
        <span className="text-[12px] font-semibold text-[#15803D] bg-[#E7F6EC] px-2.5 py-1 rounded-full">Auto-scored · pass 80%</span>
      </div>
      <div className="text-[15px] font-semibold text-ink mb-3">A guest wants a salad but is allergic to nuts. What do you do?</div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-[#15803D]/40 bg-[#E7F6EC] px-3.5 py-2.5 text-[13.5px] font-semibold text-[#15803D]">
          <span>✓</span> Check for cross-contact, confirm with the kitchen, or offer a safe swap
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[13.5px] text-muted-2">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-line-strong inline-block shrink-0" /> Just pick off the visible nuts
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[13.5px] text-muted-2">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-line-strong inline-block shrink-0" /> Tell them it&rsquo;s probably fine
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-paper overflow-hidden"><div className="h-full w-2/5 bg-brick rounded-full" /></div>
        <span className="text-[12px] text-muted-2 font-medium">EN / ES</span>
      </div>
    </div>
  );
}

// REVIEWS — a Google review with the AI "Wingman's read".
export function ReviewsVisual() {
  return (
    <div className="bg-white border border-line rounded-3xl p-6 sm:p-7 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="text-[#F5A623] font-bold tabular-nums">4.6</span> <Stars n={5} /> <span className="text-[12.5px] text-muted-2 font-normal">· 128 Google reviews</span>
        </div>
        <span className="text-[11.5px] font-semibold text-[#4d7c0f] bg-olive-tint px-2.5 py-1 rounded-full">Strong</span>
      </div>
      <div className="rounded-2xl bg-paper p-3.5 mb-3">
        <div className="flex items-center gap-2 text-[12.5px] mb-1"><Stars n={5} /> <span className="font-semibold text-ink">Dana P.</span> <span className="text-muted-2">· 3d ago</span></div>
        <p className="text-[13px] text-charcoal-2 leading-[1.5]">&ldquo;Server remembered our anniversary from last year. Food was perfect. Only wish the wait was shorter on a Friday.&rdquo;</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-olive/25 bg-olive-tint/30 p-3.5">
          <div className="text-[12px] font-semibold text-[#4d7c0f] mb-1">Guests love</div>
          <div className="text-[13px] text-charcoal-2 leading-[1.4]">Personal service, remembering regulars</div>
        </div>
        <div className="rounded-2xl border border-[#B45309]/20 bg-[#FDF3E1] p-3.5">
          <div className="text-[12px] font-semibold text-[#B45309] mb-1">Improve</div>
          <div className="text-[13px] text-charcoal-2 leading-[1.4]">Friday-night wait times</div>
        </div>
      </div>
    </div>
  );
}
