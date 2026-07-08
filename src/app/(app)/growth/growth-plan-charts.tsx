import type { GrowthPhase } from "@/lib/growth-plan";

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function PhaseComparisonChart({ phases }: { phases: GrowthPhase[] }) {
  const max = Math.max(...phases.map((p) => p.total), 1);
  const barColors = ["bg-[#D4D4D4]", "bg-brick-tint", "bg-brick"];

  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Revenue by plan</div>
      <div className="text-[13px] text-muted mb-6">Current vs. 10/10/10 vs. your target.</div>
      <div className="flex items-end gap-6 h-[200px]">
        {phases.map((p, i) => (
          <div key={p.label} className="flex-1 flex flex-col items-center justify-end gap-3 h-full">
            <div className="text-sm font-semibold text-ink tabular-nums">{fmtMoney(p.total)}</div>
            <div
              className={`w-full rounded-t-lg ${barColors[i % barColors.length]}`}
              style={{ height: `${Math.max((p.total / max) * 140, 4)}px` }}
            />
            <div className="text-xs font-semibold text-muted text-center">{p.label}</div>
            {i > 0 && <div className="text-[11px] font-semibold text-[#15803D]">+{p.pctIncreaseVsBase.toFixed(1)}%</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrajectoryChart({
  points,
  frequency,
}: {
  points: { period: number; total: number }[];
  frequency: "weekly" | "monthly";
}) {
  const max = Math.max(...points.map((p) => p.total), 1);
  const w = 880;
  const h = 240;
  const padY = 28;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: h - padY - (p.total / max) * (h - padY * 2),
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = coords.length > 0 ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)} ${h} L0 ${h} Z` : "";
  const unitLabel = frequency === "weekly" ? "wk" : "mo";
  const periodCount = points.length - 1;
  const last = coords[coords.length - 1];

  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Projected trajectory</div>
      <div className="text-[13px] text-muted mb-6">
        If your target's growth rate is sustained every {frequency === "weekly" ? "week" : "month"} for {periodCount} {frequency === "weekly" ? "weeks" : "months"}.
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="gp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A6CFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0A6CFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#gp-area)" />}
        <path d={linePath} fill="none" stroke="#0A6CFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(
          (c, i) =>
            (i === 0 || i === coords.length - 1 || i % Math.max(Math.ceil(points.length / 6), 1) === 0) && (
              <circle key={i} cx={c.x} cy={c.y} r="4" fill="#fff" stroke="#0A6CFF" strokeWidth="2.5" />
            )
        )}
        {last && (
          <text x={last.x} y={last.y - 14} textAnchor="end" fontSize="14" fontWeight="700" fill="#0757D6">
            {fmtMoney(points[points.length - 1].total)}
          </text>
        )}
        <text x="0" y={h - 6} fontSize="12" fontWeight="500" fill="#A3A3A3">
          Now
        </text>
        <text x={w} y={h - 6} textAnchor="end" fontSize="12" fontWeight="500" fill="#A3A3A3">
          +{periodCount} {unitLabel}
        </text>
      </svg>
    </div>
  );
}
