"use client";

import { useState } from "react";
import Link from "next/link";
import { leadResultRows, sourceLabel } from "@/lib/crm";

export type LeadRow = {
  id: string;
  name: string | null;
  email: string;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
  automation: string | null;
  contactId: string | null;
};

function shortDetail(row: LeadRow): string {
  const rows = leadResultRows(row.source, row.payload);
  return rows.slice(0, 2).map((r) => `${r.value}`).join(" · ");
}

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  const [selected, setSelected] = useState<LeadRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl shadow-sm p-6">
        <p className="text-sm text-muted">No leads yet. They&apos;ll appear here as people use the demo, chat, calculator, and scorecard.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 border-b border-line">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Automation</th>
                <th className="px-5 py-3">Detail</th>
                <th className="px-5 py-3 whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row)} className="border-b border-[#F5F5F5] last:border-0 hover:bg-paper cursor-pointer transition-colors">
                  <td className="px-5 py-3">
                    <div className="text-[14px] font-semibold text-ink">{row.name || "—"}</div>
                    <div className="text-[12.5px] text-muted-2">{row.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full capitalize">{row.source}</span>
                  </td>
                  <td className="px-5 py-3">
                    {row.automation ? (
                      <span className="text-[12px] font-medium text-olive bg-olive-tint px-2 py-0.5 rounded-full">{row.automation}</span>
                    ) : (
                      <span className="text-[13px] text-muted-2">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-charcoal-2">{shortDetail(row)}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-2 whitespace-nowrap">{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div className="min-w-0">
                <div className="text-[18px] font-semibold text-ink truncate">{selected.name || "Lead"}</div>
                <a href={`mailto:${selected.email}`} className="text-[13.5px] text-brick hover:opacity-70 break-all">{selected.email}</a>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="text-muted-2 hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-[12px] font-semibold text-charcoal-2 bg-paper border border-line px-2.5 py-0.5 rounded-full">Via {sourceLabel(selected.source)}</span>
                {selected.automation && <span className="text-[12px] font-medium text-olive bg-olive-tint px-2.5 py-0.5 rounded-full">{selected.automation}</span>}
                <span className="text-[12px] text-muted-2 px-1 py-0.5">{new Date(selected.created_at).toLocaleString()}</span>
              </div>

              {leadResultRows(selected.source, selected.payload).length > 0 ? (
                <dl className="bg-paper border border-line rounded-xl p-4 flex flex-col gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-2 mb-1">Their results</div>
                  {leadResultRows(selected.source, selected.payload).map((r) => (
                    <div key={r.label} className="flex justify-between gap-3 text-[13.5px]">
                      <dt className="text-muted">{r.label}</dt>
                      <dd className="text-ink font-semibold text-right">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-[13.5px] text-muted-2">No extra detail captured for this source.</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-semibold text-charcoal-2 px-4 py-2 rounded-lg hover:bg-paper transition-colors">
                Close
              </button>
              {selected.contactId && (
                <>
                  <Link href={`/admin/conversations/${selected.contactId}`} className="text-[13px] font-semibold text-charcoal-2 bg-paper border border-line rounded-lg px-4 py-2 hover:bg-white transition-colors">
                    Conversation →
                  </Link>
                  <Link href={`/admin/crm/${selected.contactId}`} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark transition-colors">
                    Open full contact →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
