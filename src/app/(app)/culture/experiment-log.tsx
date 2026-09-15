"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteExperiment } from "./actions";

export type LoggedExperiment = {
  id: string;
  hypothesis: string;
  outcome: string | null;
  outcomeNote: string | null;
  closedOn: string | null;
};

const OUTCOME_STYLE: Record<string, { label: string; cls: string }> = {
  worked: { label: "Worked", cls: "text-[#15803D] bg-[#E7F6EC]" },
  mixed: { label: "Mixed", cls: "text-[#B45309] bg-[#FDF3E1]" },
  no_change: { label: "No change", cls: "text-charcoal-2 bg-[#F1F1F1]" },
};

function fmt(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Past weekly experiments and how they turned out — the "did it work?" history
// that closes the loop. Managers can remove a stray entry.
export function ExperimentLog({ items, canEdit }: { items: LoggedExperiment[]; canEdit: boolean }) {
  const [pending, start] = useTransition();

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No experiments logged yet. Set this week&apos;s experiment above, then record how it went — the results build up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((e) => {
        const style = e.outcome ? OUTCOME_STYLE[e.outcome] : null;
        return (
          <li key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {style && (
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.04em] px-2 py-0.5 rounded-full ${style.cls}`}>
                    {style.label}
                  </span>
                )}
                {e.closedOn && <span className="text-[12px] text-muted-2">{fmt(e.closedOn)}</span>}
              </div>
              <div className="text-sm text-ink leading-[1.45]">{e.hypothesis}</div>
              {e.outcomeNote && <div className="text-[13px] text-muted mt-0.5 leading-[1.45]">{e.outcomeNote}</div>}
            </div>
            {canEdit && (
              <button
                type="button"
                aria-label="Remove entry"
                disabled={pending}
                onClick={() => start(async () => { await deleteExperiment(e.id); })}
                className="text-muted-2 hover:text-danger disabled:opacity-40 pt-0.5"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
