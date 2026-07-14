"use client";

import { useMemo, useState } from "react";
import { statusForCompletion } from "@/lib/hospitality";
import { StatusPill } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/pill";

type Signoff = { id: string; staff_name: string; department: string; completion_pct: number; occurred_on: string };

const FILTERS = ["All", "Signed off", "In progress", "Needs coaching"] as const;

export function SignoffLog({ signoffs }: { signoffs: Signoff[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const filtered = useMemo(() => {
    if (filter === "All") return signoffs;
    return signoffs.filter((s) => statusForCompletion(s.completion_pct).label === filter);
  }, [signoffs, filter]);

  return (
    <div className="bg-white border border-line rounded-2xl overflow-x-auto shadow-sm">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Sign-off log</span>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
                filter === f ? "text-brick-dark bg-brick-tint" : "text-muted bg-paper hover:bg-line"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-[#FAFAFA] text-left">
            <th className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Department</th>
            <th className="px-4 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Owner</th>
            <th className="px-4 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Status</th>
            <th className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Date</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => {
            const status = statusForCompletion(s.completion_pct);
            return (
              <tr key={s.id} className="hover:bg-[#FAFAFA] transition-colors">
                <td className="px-6 py-3.5 border-b border-[#F5F5F5]">
                  <Pill>{s.department}</Pill>
                </td>
                <td className="px-4 py-3.5 text-charcoal-2 border-b border-[#F5F5F5]">{s.staff_name}</td>
                <td className="px-4 py-3.5 border-b border-[#F5F5F5]">
                  <StatusPill label={status.label} fg={status.fg} bg={status.bg} dot={status.dot} />
                </td>
                <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5] tabular-nums">{s.occurred_on}</td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-muted">
                No sign-offs match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
