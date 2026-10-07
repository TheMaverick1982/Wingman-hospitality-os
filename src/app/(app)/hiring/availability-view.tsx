import { Fragment } from "react";
import { AVAIL_DAYS, AVAIL_SHIFTS, ANYTIME } from "@/lib/availability";

// Read-only view of an applicant's availability. Shows the ticked weekly shift
// grid for new applications, an "Anytime / flexible" pill when they chose that,
// and falls back to the free-text summary for older applications that have no
// structured shifts.
export function AvailabilityView({ shifts, text }: { shifts: string[]; text: string }) {
  if (shifts.includes(ANYTIME)) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-olive bg-olive-tint rounded-full px-2.5 py-1">
        Anytime / flexible
      </span>
    );
  }

  if (shifts.length === 0) {
    return text ? <span className="text-[13px] text-charcoal-2">{text}</span> : <span className="text-[13px] text-muted-2">Not specified</span>;
  }

  const set = new Set(shifts);
  return (
    <div className="inline-block rounded-lg border border-line overflow-hidden text-center">
      <div className="grid grid-cols-[auto_repeat(3,minmax(44px,1fr))]">
        <span className="bg-panel" />
        {AVAIL_SHIFTS.map((s) => (
          <span key={s.id} className="bg-panel px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.03em] text-muted-2">
            {s.label.slice(0, 3)}
          </span>
        ))}
        {AVAIL_DAYS.map((d) => (
          <Fragment key={d.id}>
            <span className="px-2 py-1.5 text-[11px] font-bold text-charcoal-2 bg-panel/60 border-t border-line">{d.label}</span>
            {AVAIL_SHIFTS.map((s) => {
              const on = set.has(`${d.id}:${s.id}`);
              return (
                <span
                  key={s.id}
                  className={`px-1 py-1.5 border-t border-l border-line text-[11px] ${on ? "bg-brick text-white font-bold" : "text-line-strong"}`}
                >
                  {on ? "✓" : "·"}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
