import type { GrowthPhase } from "@/lib/growth-plan";

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function BoxValue({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex-1 min-w-[104px] border rounded-xl px-3 py-2.5 text-center ${
        highlight ? "bg-brick-tint border-[#CFE0FF]" : "bg-paper border-line"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-2 mb-1">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${highlight ? "text-brick-dark" : "text-ink"}`}>{value}</div>
    </div>
  );
}

// Mirrors the classic "10/10/10" worksheet layout: each row is its own
// customers x avg sale x frequency = total multiplication, not a spreadsheet
// row, so the compounding story reads clearly at a glance.
export function PhaseBreakdown({ phases }: { phases: GrowthPhase[] }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm flex flex-col gap-7">
      {phases.map((p, i) => (
        <div key={p.label} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-ink">{p.label}</span>
            {p.sublabel && <span className="text-xs font-medium text-muted">{p.sublabel}</span>}
            {i > 0 && <span className="text-xs font-semibold text-[#15803D] ml-auto">+{p.pctIncreaseVsBase.toFixed(1)}% vs. current</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <BoxValue label="# of customers" value={p.customers.toFixed(1)} />
            <span className="text-muted-2 text-lg font-bold shrink-0">×</span>
            <BoxValue label="Avg $ per sale" value={`$${p.avgSale.toFixed(2)}`} />
            <span className="text-muted-2 text-lg font-bold shrink-0">×</span>
            <BoxValue label="Repurchase freq." value={p.repurchaseFrequency.toFixed(2)} />
            <span className="text-muted-2 text-lg font-bold shrink-0">=</span>
            <BoxValue label="Total" value={fmtMoney(p.total)} highlight />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PhaseComparisonChart({ phases }: { phases: GrowthPhase[] }) {
  const max = Math.max(...phases.map((p) => p.total), 1);
  const barColors = ["bg-[#D4D4D4]", "bg-brick-tint", "bg-brick"];

  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Revenue by plan</div>
      <div className="text-[13px] text-muted mb-6">Current vs. compounded growth vs. your target.</div>
      <div className="flex items-end gap-6 h-[200px]">
        {phases.map((p, i) => (
          <div key={p.label} className="flex-1 flex flex-col items-center justify-end gap-3 h-full">
            <div className="text-sm font-semibold text-ink tabular-nums">{fmtMoney(p.total)}</div>
            <div
              className={`w-full rounded-t-lg ${barColors[i % barColors.length]}`}
              style={{ height: `${Math.max((p.total / max) * 140, 4)}px` }}
            />
            <div className="text-xs font-semibold text-muted text-center">
              {p.label}
              {p.sublabel && <div className="text-[10px] font-medium text-muted-2">{p.sublabel}</div>}
            </div>
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

export function ActualsChart({ entries }: { entries: { periodDate: string; total: number }[] }) {
  if (entries.length === 0) return null;

  const max = Math.max(...entries.map((e) => e.total), 1);
  const w = 880;
  const h = 220;
  const padY = 28;
  const stepX = entries.length > 1 ? w / (entries.length - 1) : 0;
  const coords = entries.map((e, i) => ({
    x: entries.length > 1 ? i * stepX : w / 2,
    y: h - padY - (e.total / max) * (h - padY * 2),
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Actual revenue over time</div>
      <div className="text-[13px] text-muted mb-6">From your logged entries.</div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto overflow-visible">
        <path d={linePath} fill="none" stroke="#0A6CFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="4" fill="#fff" stroke="#0A6CFF" strokeWidth="2.5" />
        ))}
        {first && (
          <text x={first.x} y={first.y - 14} textAnchor="start" fontSize="13" fontWeight="700" fill="#0757D6">
            {fmtMoney(entries[0].total)}
          </text>
        )}
        {last && entries.length > 1 && (
          <text x={last.x} y={last.y - 14} textAnchor="end" fontSize="13" fontWeight="700" fill="#0757D6">
            {fmtMoney(entries[entries.length - 1].total)}
          </text>
        )}
        <text x="0" y={h - 6} fontSize="12" fontWeight="500" fill="#A3A3A3">
          {entries[0].periodDate}
        </text>
        <text x={w} y={h - 6} textAnchor="end" fontSize="12" fontWeight="500" fill="#A3A3A3">
          {entries[entries.length - 1].periodDate}
        </text>
      </svg>
    </div>
  );
}

export function ActualsGrowthChart({ entries }: { entries: { periodDate: string; total: number }[] }) {
  if (entries.length < 2) return null;

  const growthBars = entries.slice(1).map((e, i) => {
    const prevTotal = entries[i].total;
    const pct = prevTotal > 0 ? ((e.total - prevTotal) / prevTotal) * 100 : 0;
    return { periodDate: e.periodDate, pct };
  });
  const maxAbs = Math.max(...growthBars.map((g) => Math.abs(g.pct)), 1);
  const barAreaHeight = 130;

  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Period-over-period growth</div>
      <div className="text-[13px] text-muted mb-6">% change in total revenue vs. the period before.</div>
      <div className="flex items-end gap-2.5" style={{ height: barAreaHeight + 56 }}>
        {growthBars.map((g) => {
          const isPositive = g.pct >= 0;
          return (
            <div key={g.periodDate} className="flex-1 flex flex-col items-center justify-end gap-2 min-w-0">
              <span className={`text-[11px] font-semibold whitespace-nowrap ${isPositive ? "text-[#15803D]" : "text-danger"}`}>
                {isPositive ? "+" : ""}
                {g.pct.toFixed(1)}%
              </span>
              <div
                className={`w-full rounded-t-md ${isPositive ? "bg-[#16A34A]" : "bg-danger"}`}
                style={{ height: `${Math.max((Math.abs(g.pct) / maxAbs) * barAreaHeight, 4)}px` }}
              />
              <span className="text-[10px] text-muted-2 truncate w-full text-center">{g.periodDate}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type GoalMetrics = { customers: number; avgSale: number; repurchaseFrequency: number };

export function GoalGapAnalysis({ latest, target }: { latest: GoalMetrics; target: GoalMetrics }) {
  const levers = [
    { key: "customers", label: "# of customers", actual: latest.customers, target: target.customers },
    { key: "avgSale", label: "Average $ per sale", actual: latest.avgSale, target: target.avgSale },
    { key: "repurchaseFrequency", label: "Repurchase frequency", actual: latest.repurchaseFrequency, target: target.repurchaseFrequency },
  ].map((lv) => ({ ...lv, pctOfGoal: lv.target > 0 ? (lv.actual / lv.target) * 100 : 0 }));

  const worst = [...levers].sort((a, b) => a.pctOfGoal - b.pctOfGoal)[0];

  return (
    <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">What needs improvement</div>
      <div className="text-[13px] text-muted mb-6">
        Your most recently logged numbers vs. your target plan — <strong className="text-ink">{worst.label}</strong> is furthest behind.
      </div>
      <div className="flex flex-col gap-4">
        {levers.map((lv) => {
          const isWorst = lv.key === worst.key;
          const barPct = Math.min(Math.max(lv.pctOfGoal, 0), 100);
          return (
            <div key={lv.key}>
              <div className="flex items-baseline justify-between mb-1.5 gap-3">
                <span className={`text-sm font-medium flex items-center gap-2 ${isWorst ? "text-danger" : "text-ink"}`}>
                  {lv.label}
                  {isWorst && (
                    <span className="text-[11px] font-semibold bg-danger-tint text-danger px-2 py-0.5 rounded-full whitespace-nowrap">
                      Focus here
                    </span>
                  )}
                </span>
                <span className="text-[13px] font-semibold text-muted tabular-nums shrink-0">{lv.pctOfGoal.toFixed(0)}% of goal</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#F1F1F1] overflow-hidden">
                <div className={`h-full rounded-full ${isWorst ? "bg-danger" : "bg-brick"}`} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
