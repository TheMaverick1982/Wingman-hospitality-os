import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import type { Momentum } from "@/lib/momentum";

// The one-line "are we winning this week?" verdict at the top of the dashboard.
// Leads with the outcome that matters (repeat rate + its real week-over-week
// move), then points at the single most useful next move. All values are real.
export function WeekVerdict({
  repeatRate,
  repeatDelta,
  momentum,
}: {
  repeatRate: number;
  repeatDelta: number;
  momentum: Momentum | null;
}) {
  const up = repeatDelta > 0;
  const down = repeatDelta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up ? "text-[#15803d]" : down ? "text-[#b42318]" : "text-muted-2";
  const pts = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

  const headline = up
    ? `Repeat rate is up ${pts(repeatDelta)} this week — ${repeatRate}% of guests come back for a 2nd visit.`
    : down
      ? `Repeat rate slipped ${pts(Math.abs(repeatDelta))} to ${repeatRate}% this week — worth a look.`
      : `Repeat rate is holding at ${repeatRate}%${repeatRate > 0 ? " — keep it climbing." : " — log a repeat guest to get it moving."}`;

  const nextMove = momentum?.topGap ?? null;

  return (
    <div className="bg-white border border-line rounded-2xl px-6 py-4 flex items-center gap-3 flex-wrap shadow-sm">
      <Icon size={18} className={`${tone} shrink-0`} />
      <span className="text-[14.5px] text-ink flex-1 min-w-[240px] leading-snug">
        <span className="font-semibold">This week:</span> {headline}
      </span>
      {nextMove && (
        <Link
          href={nextMove.href}
          className="text-[13px] font-semibold text-brick whitespace-nowrap inline-flex items-center gap-1 hover:opacity-80"
        >
          Next: {nextMove.nudge} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
