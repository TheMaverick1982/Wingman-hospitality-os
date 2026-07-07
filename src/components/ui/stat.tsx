import type { LucideIcon } from "lucide-react";

const TONE_CLASSES = {
  ink: "text-ink",
  brick: "text-brick",
  olive: "text-olive",
  gold: "text-gold",
  danger: "text-danger",
} as const;

export function Stat({
  label,
  value,
  sub,
  tone = "ink",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: keyof typeof TONE_CLASSES;
  icon?: LucideIcon;
}) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-5 flex-1 min-w-[180px] shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted text-xs uppercase tracking-wide font-semibold">{label}</span>
        {Icon && <Icon size={16} className={TONE_CLASSES[tone]} strokeWidth={2} />}
      </div>
      <div className={`${TONE_CLASSES[tone]} font-mono text-[44px] font-semibold leading-none tracking-tight`}>
        {value}
      </div>
      {sub && <div className="text-muted text-xs mt-2">{sub}</div>}
    </div>
  );
}
