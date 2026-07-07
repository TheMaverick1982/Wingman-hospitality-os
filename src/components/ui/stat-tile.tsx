const TREND_CLASSES = {
  up: "text-[#15803D] bg-[#E7F6EC]",
  down: "text-[#B91C1C] bg-danger-tint",
  flat: "text-muted bg-[#F1F1F1]",
} as const;

export function StatTile({
  label,
  value,
  sub,
  trend,
  trendTone = "flat",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  trend?: string;
  trendTone?: keyof typeof TREND_CLASSES;
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-[22px] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] text-muted font-medium">{label}</span>
        {trend && (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${TREND_CLASSES[trendTone]}`}>{trend}</span>
        )}
      </div>
      <div className="text-[38px] font-semibold tracking-[-0.02em] leading-none text-ink">{value}</div>
      {sub && <div className="text-[13px] text-muted mt-2.5">{sub}</div>}
    </div>
  );
}
