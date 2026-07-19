"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { sourceLabel } from "@/lib/crm";
import { restoreLead } from "../actions";

export type DeletedLeadRow = {
  id: string;
  name: string | null;
  email: string;
  source: string;
  created_at: string;
  deleted_at: string;
};

export function DeletedLeadsTable({ rows: initialRows }: { rows: DeletedLeadRow[] }) {
  const [rows, setRows] = useState<DeletedLeadRow[]>(initialRows);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleRestore = (row: DeletedLeadRow) => {
    setRestoringId(row.id);
    startTransition(async () => {
      const res = await restoreLead(row.id);
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== row.id));
      else window.alert(res.error || "Couldn't restore that lead. Please try again.");
      setRestoringId(null);
    });
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl shadow-sm p-6">
        <p className="text-sm text-muted">Nothing in the trash. Deleted leads show up here and can be restored.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 border-b border-line">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3 whitespace-nowrap">Deleted</th>
              <th className="px-5 py-3 w-px"><span className="sr-only">Restore</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#F5F5F5] last:border-0">
                <td className="px-5 py-3">
                  <div className="text-[14px] font-semibold text-ink">{row.name || "—"}</div>
                  <div className="text-[12.5px] text-muted-2">{row.email}</div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-[12px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full capitalize">{sourceLabel(row.source)}</span>
                </td>
                <td className="px-5 py-3 text-[13px] text-muted-2 whitespace-nowrap">{new Date(row.deleted_at).toLocaleDateString()}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRestore(row)}
                    disabled={restoringId === row.id}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 bg-paper border border-line rounded-lg px-3 py-1.5 hover:bg-white hover:text-ink disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw size={14} strokeWidth={2} />
                    {restoringId === row.id ? "Restoring…" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
