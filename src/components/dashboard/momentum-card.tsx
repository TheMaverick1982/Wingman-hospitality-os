import Link from "next/link";
import { Flame, Check, ArrowRight } from "lucide-react";
import type { Momentum } from "@/lib/momentum";

// Usage momentum, separate from Business Health. Shows this week's active habits,
// the streak (loss aversion), and the single next move when they're drifting.
export function MomentumCard({ momentum }: { momentum: Momentum }) {
  const { score, label, streakWeeks, habits, topGap, stalled } = momentum;

  const tone = stalled
    ? { bar: "bg-[#B45309]", text: "text-[#B45309]", tint: "bg-gold-tint" }
    : score >= 80
      ? { bar: "bg-olive", text: "text-olive", tint: "bg-olive-tint" }
      : { bar: "bg-brick", text: "text-brick-dark", tint: "bg-brick-tint" };

  return (
    <div className="bg-white border border-line rounded-[20px] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={17} className={tone.text} />
            <span className="text-[15px] font-bold text-ink">Your momentum</span>
          </div>
          <p className="text-[13px] text-muted mt-0.5 max-w-md">
            Are you running the plays this week? This is the habit score behind your results.
          </p>
        </div>
        <div className="text-right">
          <div className={`text-[26px] font-bold tabular-nums leading-none ${tone.text}`}>{label}</div>
          <div className="text-[12px] text-muted-2 mt-1">
            {momentum.activeHabits} of {momentum.totalHabits} habits active
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-line overflow-hidden mt-4">
        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${score}%` }} />
      </div>

      {streakWeeks > 0 && (
        <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#B45309]">
          <Flame size={14} /> {streakWeeks}-week streak — don&rsquo;t break it.
        </div>
      )}

      {/* Habit chips */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {habits.map((h) => (
          <Link
            key={h.key}
            href={h.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-colors ${
              h.active ? "bg-olive-tint border-olive/30" : "bg-paper border-line hover:border-brick"
            }`}
          >
            <span
              className={`shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center ${
                h.active ? "bg-olive text-white" : "border-[1.5px] border-line-strong"
              }`}
            >
              {h.active && <Check size={11} strokeWidth={3} />}
            </span>
            <span className={`text-[13px] flex-1 min-w-0 truncate ${h.active ? "font-semibold text-ink" : "text-muted"}`}>
              {h.label}
            </span>
            {h.active && h.count > 0 && <span className="text-[12px] font-semibold text-olive tabular-nums">{h.count}</span>}
          </Link>
        ))}
      </div>

      {/* One clear move when drifting */}
      {topGap && (
        <Link
          href={topGap.href}
          className={`mt-4 flex items-center gap-3 rounded-xl px-4 py-3 ${tone.tint} hover:brightness-[0.98] transition-[filter]`}
        >
          <span className={`text-[13px] flex-1 ${tone.text}`}>
            <span className="font-semibold">{stalled ? "Your one move to restart momentum:" : "Your one move this week:"}</span>{" "}
            {topGap.nudge}.
          </span>
          <ArrowRight size={15} className={`${tone.text} shrink-0`} />
        </Link>
      )}
    </div>
  );
}
