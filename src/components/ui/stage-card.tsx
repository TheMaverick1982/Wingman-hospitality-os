export function StageCard({
  label,
  pct,
  sub,
  active,
}: {
  label: string;
  pct: number;
  sub: string;
  active?: boolean;
}) {
  return (
    <div
      className={`p-5 flex-1 min-w-[150px] rounded-2xl border border-b-[3px] border-dashed ${
        active ? "bg-charcoal border-charcoal" : "bg-panel border-line"
      }`}
    >
      <div className={`text-sm font-medium mb-2 ${active ? "text-[#f5f5f5]" : "text-ink"}`}>{label}</div>
      <div className={`font-mono text-3xl font-semibold mb-2 ${active ? "text-white" : "text-brick"}`}>
        {pct}%
      </div>
      <div className={`rounded h-1.5 mb-2 overflow-hidden ${active ? "bg-white/15" : "bg-line"}`}>
        <div
          className={`h-full ${active ? "bg-gold" : "bg-brick"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`text-xs ${active ? "text-[#a1a1a1]" : "text-muted"}`}>{sub}</div>
    </div>
  );
}
