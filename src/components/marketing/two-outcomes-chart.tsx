export function TwoOutcomesChart() {
  return (
    <div className="relative pb-8 lg:pb-20">
      <div
        className="w-full rounded-[24px] overflow-hidden border border-black/[0.06] bg-white flex flex-col px-5 sm:px-10 pt-6 sm:pt-8 pb-6 sm:pb-7 lg:aspect-[16/9]"
        style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.16)" }}
      >
        <div className="flex items-start justify-between gap-5 gap-y-4 flex-wrap">
          <div>
            <div className="text-lg sm:text-xl font-semibold tracking-[-0.015em] text-ink">Same guests. Two outcomes.</div>
            <div className="text-sm text-muted mt-1">Cumulative guest visits, one-time traffic vs. retained</div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink whitespace-nowrap">
              <span className="w-3 h-3 rounded-[3px] bg-brick inline-block shrink-0" />
              With Wingman — they come back
            </div>
            <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-2 whitespace-nowrap">
              <span className="w-3 h-0.5 rounded bg-[#c4c4c4] inline-block shrink-0" />
              One-time visit
            </div>
          </div>
        </div>

        <svg viewBox="0 0 880 400" preserveAspectRatio="xMidYMid meet" className="w-full flex-1 mt-4 lg:mt-2 min-h-[220px] overflow-visible" role="img" aria-label="Two outcomes over time: a flat line when first-time guests never return, versus compounding growth when they become repeat regulars.">
          <defs>
            <linearGradient id="wmArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A6CFF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0A6CFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="70" y1="320" x2="835" y2="320" stroke="#E5E5E5" strokeWidth="1.5" />
          <line x1="70" y1="240" x2="835" y2="240" stroke="#F1F1F1" strokeWidth="1" />
          <line x1="70" y1="160" x2="835" y2="160" stroke="#F1F1F1" strokeWidth="1" />
          <line x1="70" y1="80" x2="835" y2="80" stroke="#F1F1F1" strokeWidth="1" />

          <path d="M90 280 L276 232 L462 180 L648 138 L820 100 L820 320 L90 320 Z" fill="url(#wmArea)" />
          <path d="M90 280 L276 306 L462 313 L648 316 L820 318" fill="none" stroke="#C4C4C4" strokeWidth="3" strokeDasharray="7 7" strokeLinecap="round" />
          <path d="M90 280 L276 232 L462 180 L648 138 L820 100" fill="none" stroke="#0A6CFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          <circle cx="90" cy="280" r="5.5" fill="#fff" stroke="#0A6CFF" strokeWidth="3" />
          <circle cx="276" cy="232" r="5.5" fill="#fff" stroke="#0A6CFF" strokeWidth="3" />
          <circle cx="462" cy="180" r="5.5" fill="#fff" stroke="#0A6CFF" strokeWidth="3" />
          <circle cx="648" cy="138" r="5.5" fill="#fff" stroke="#0A6CFF" strokeWidth="3" />
          <circle cx="820" cy="100" r="7" fill="#0A6CFF" stroke="#fff" strokeWidth="3" />

          <text x="820" y="76" textAnchor="end" fontSize="16" fontWeight="700" fill="#0757D6">Loyal regulars</text>
          <text x="820" y="342" textAnchor="end" fontSize="14" fontWeight="600" fill="#A3A3A3">One and done</text>
          <text x="90" y="360" textAnchor="middle" fontSize="13" fontWeight="500" fill="#A3A3A3">Visit 1</text>
          <text x="276" y="360" textAnchor="middle" fontSize="13" fontWeight="500" fill="#A3A3A3">Visit 2</text>
          <text x="462" y="360" textAnchor="middle" fontSize="13" fontWeight="500" fill="#A3A3A3">Visit 3</text>
          <text x="648" y="360" textAnchor="middle" fontSize="13" fontWeight="500" fill="#A3A3A3">Visit 4</text>
          <text x="820" y="360" textAnchor="middle" fontSize="13" fontWeight="500" fill="#A3A3A3">Visit 5</text>
        </svg>

        {/* Below lg the floating stat card (further down) has no room and would
            overlap the chart, so the same stat is shown inline here instead. */}
        <div className="lg:hidden flex items-center justify-between gap-4 mt-5 pt-5 border-t border-[#F1F1F1]">
          <div>
            <div className="text-[13px] text-muted font-medium">Repeat rate</div>
            <div className="text-[13px] text-muted mt-0.5">back for visit 2</div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[30px] font-semibold tracking-[-0.02em] leading-none text-ink">62%</span>
            <span className="text-xs font-semibold text-[#15803d] bg-[#e7f6ec] rounded-full px-[9px] py-[3px] whitespace-nowrap">+4.2%</span>
          </div>
        </div>
      </div>

      <div
        className="hidden lg:block absolute bg-white border border-[#ededed] rounded-[18px] py-5 px-[22px] w-[210px]"
        style={{ bottom: "47%", left: "-14px", boxShadow: "0 16px 40px rgba(0,0,0,0.12)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-muted font-medium">Repeat rate</span>
          <span className="text-xs font-semibold text-[#15803d] bg-[#e7f6ec] rounded-full px-[9px] py-[3px]">+4.2%</span>
        </div>
        <div className="text-[46px] font-semibold tracking-[-0.02em] leading-none text-ink">62%</div>
        <div className="text-[13px] text-muted mt-2">back for visit 2</div>
      </div>
    </div>
  );
}
