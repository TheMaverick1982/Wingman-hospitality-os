const STATS = [
  { value: "62%", label: "of first-time guests brought back for visit 2" },
  { value: "2.1%", label: "discount rate, down from a 7% baseline" },
  { value: "128", label: "culture moments recognized this quarter" },
];

export function StatsBand() {
  return (
    <div className="bg-[#0a0a0a] text-white">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-[88px]">
        <div className="text-xs font-semibold tracking-[0.1em] uppercase text-[#6b6b6b] mb-10">What a strong month looks like</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STATS.map((s) => (
          <div key={s.label} className="px-0 sm:px-2">
            <div
              className="font-display text-6xl sm:text-[72px] font-bold tracking-[-0.03em] leading-none bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(180deg, #fff 0%, #B7B7B7 100%)" }}
            >
              {s.value}
            </div>
            <div className="text-base text-[#a1a1a1] mt-4 leading-[1.45] max-w-[280px]">{s.label}</div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
