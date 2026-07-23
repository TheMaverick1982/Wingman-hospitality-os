import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { StaffTest } from "@/lib/data/staff-tests";

const STATUS: Record<string, { label: string; fg: string; bg: string; dot: string }> = {
  assigned: { label: "Not started", fg: "text-brick-dark", bg: "bg-brick-tint", dot: "bg-brick" },
  in_progress: { label: "In progress", fg: "text-[#b45309]", bg: "bg-gold-tint", dot: "bg-[#d9922a]" },
  passed: { label: "Passed", fg: "text-[#15803d]", bg: "bg-olive-tint", dot: "bg-olive" },
  locked: { label: "Locked", fg: "text-danger", bg: "bg-danger-tint", dot: "bg-danger" },
};

// Renders a staffer's tests as clickable rows: ones still to take link to the
// take-test flow; completed ones show the score they got.
export function StaffTests({ tests, emptyLabel }: { tests: StaffTest[]; emptyLabel: string }) {
  if (tests.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {tests.map((t) => {
        const s = STATUS[t.status] ?? STATUS.assigned;
        const score = t.bestScore ?? t.lastScore;
        const done = t.status === "passed" || t.status === "locked";
        const inner = (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <GraduationCap size={17} className="text-brick shrink-0" />
              <span className="text-sm font-semibold text-ink truncate">{t.title ?? "Test"}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {score != null && (
                <span className="text-[12.5px] tabular-nums text-muted">
                  {score}%{t.passPct != null ? ` · pass ${t.passPct}%` : ""}
                </span>
              )}
              <StatusPill label={s.label} fg={s.fg} bg={s.bg} dot={s.dot} />
              {!done && <ArrowRight size={15} className="text-brick" />}
            </div>
          </>
        );
        const rowClass = "flex items-center justify-between gap-3 p-3.5 rounded-xl border border-line";
        return done ? (
          <div key={t.testId} className={`${rowClass} bg-paper`}>
            {inner}
          </div>
        ) : (
          <Link key={t.testId} href={`/training/tests/${t.testId}/take`} className={`${rowClass} bg-white hover:border-brick transition-colors`}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
