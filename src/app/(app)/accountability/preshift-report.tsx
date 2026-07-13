import { CheckCircle2 } from "lucide-react";

export type TodayCompletion = { name: string; completedCount: number; itemCount: number; completedAt: string };
export type RosterRow = { name: string; lastCompleted: string | null; count30d: number };

// Manager/owner view of who completed a personal checklist. Built entirely from
// actual completions — nobody is marked "missing" for a day they didn't work,
// since completion itself is the signal. Reused for pre-shift and FOH loyalty.
export function PreshiftReport({
  today,
  roster,
  title = "Pre-shift checklist completion",
  sub = "Who completed their own pre-shift checklist. Only reflects days people worked.",
  emptyToday = "No one has completed their pre-shift checklist yet today.",
}: {
  today: TodayCompletion[];
  roster: RosterRow[];
  title?: string;
  sub?: string;
  emptyToday?: string;
}) {
  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-[#F1F1F1]">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
        <p className="text-[13px] text-muted mt-0.5">{sub}</p>
      </div>

      {/* Today */}
      <div className="px-6 py-4 border-b border-[#F5F5F5]">
        <div className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] mb-3">
          Completed today · {today.length}
        </div>
        {today.length > 0 ? (
          <div className="flex flex-col gap-2">
            {today.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink">
                  <CheckCircle2 size={15} className="text-[#15803d]" />
                  {t.name}
                </span>
                <span className="text-muted-2 text-[13px] tabular-nums">
                  {t.completedCount}/{t.itemCount} ·{" "}
                  {new Date(t.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{emptyToday}</p>
        )}
      </div>

      {/* 30-day roster */}
      <div className="px-6 py-4">
        <div className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] mb-3">Last 30 days</div>
        {roster.length > 0 ? (
          <table className="w-full text-sm">
            <tbody>
              {roster.map((r, i) => (
                <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                  <td className="py-2.5 text-ink">{r.name}</td>
                  <td className="py-2.5 text-right text-[13px] text-muted tabular-nums">
                    {r.count30d} completed
                  </td>
                  <td className="py-2.5 text-right text-[13px] tabular-nums pl-4">
                    {r.lastCompleted ? (
                      <span className="text-muted-2">
                        last {new Date(r.lastCompleted).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="text-muted-2">no recent completions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">No team members to show yet.</p>
        )}
      </div>
    </div>
  );
}
