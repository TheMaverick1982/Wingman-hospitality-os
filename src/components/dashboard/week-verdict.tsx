import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import type { Momentum } from "@/lib/momentum";

// The one-line "are we winning this week?" verdict at the top of the dashboard —
// the blue hero. Leads with the outcome that matters (repeat rate + its real
// week-over-week move), then points at the single most useful next move. All
// values are real.
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
  const pts = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

  const headline = up
    ? `Repeat rate is up ${pts(repeatDelta)} this week — ${repeatRate}% of guests come back for a 2nd visit.`
    : down
      ? `Repeat rate slipped ${pts(Math.abs(repeatDelta))} to ${repeatRate}% this week — worth a look.`
      : `Repeat rate is holding at ${repeatRate}%${repeatRate > 0 ? " — keep it climbing." : " — log a repeat guest to get it moving."}`;

  const nextMove = momentum?.topGap ?? null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-5 flex items-center gap-4 flex-wrap text-white shadow-md"
      style={{ backgroundImage: "linear-gradient(135deg, var(--color-brick), var(--color-brick-dark))" }}
    >
      {/* soft light bloom, top-right */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />

      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Icon size={20} className="text-white" />
      </div>

      <div className="relative flex-1 min-w-[240px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">This week</div>
        <div className="text-[16px] sm:text-[17px] font-semibold leading-snug text-white text-balance">{headline}</div>
      </div>

      {nextMove && (
        <Link
          href={nextMove.href}
          className="relative shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-brick shadow-sm hover:bg-white/90 transition-colors"
        >
          {nextMove.nudge} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
