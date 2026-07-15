import { ArrowUp, ArrowDown } from "lucide-react";

// A single dashboard KPI: the number, a one-line sub-label, an optional
// week-over-week delta (arrow + amount), and an optional sparkline of the recent
// weekly trend. Presentational only — all values are computed from real data.

function Sparkline({ series }: { series: number[] }) {
  if (!series || series.length < 2) return null;
  const max = Math.max(...series, 1);
  const w = 88;
  const h = 26;
  const step = w / (series.length - 1);
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 3) - 1.5).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const lx = w;
  const ly = h - (last / max) * (h - 3) - 1.5;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-3 overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--color-brick)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
      <circle cx={lx} cy={ly} r="2.4" fill="var(--color-brick)" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaUnit,
  series,
  sample,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number | null; // week-over-week change; positive = up
  deltaUnit?: string; // e.g. "pt" for percentage points
  series?: number[]; // recent weekly values for the sparkline
  sample?: boolean; // preview card shown before there's real data
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta) && delta !== 0;
  const up = (delta ?? 0) > 0;
  return (
    <div className="relative bg-white border border-line rounded-2xl p-[22px] shadow-sm">
      {sample && (
        <span className="absolute top-3 right-3 text-[10px] font-bold tracking-[0.06em] uppercase text-[#4d7c0f] bg-[#eaf6ec] px-1.5 py-0.5 rounded">
          Sample
        </span>
      )}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] text-muted font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <div className={`text-[38px] font-semibold tracking-[-0.02em] leading-none tabular-nums ${sample ? "text-charcoal-2" : "text-ink"}`}>{value}</div>
        {hasDelta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[12.5px] font-semibold mb-1 ${up ? "text-[#15803d]" : "text-[#b42318]"}`}
            title={`${up ? "Up" : "Down"} ${Math.abs(delta as number)}${deltaUnit ? ` ${deltaUnit}` : ""} vs last week`}
          >
            {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {Math.abs(delta as number)}
            {deltaUnit ? deltaUnit : ""}
          </span>
        )}
      </div>
      <div className="text-[13px] text-muted mt-2.5">
        {sub}
        {hasDelta ? "" : ""}
      </div>
      {series && series.length >= 2 && <Sparkline series={series} />}
    </div>
  );
}
