"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Eye, Search } from "lucide-react";
import { leadResultRows, sourceLabel } from "@/lib/crm";
import { deleteLeads } from "./actions";

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

export function LeadsTable({ rows: initialRows, isOwner }: { rows: LeadRow[]; isOwner: boolean }) {
  const router = useRouter();
  const [selected, setSelectedModal] = useState<LeadRow | null>(null);
  const [rows, setRows] = useState<LeadRow[]>(initialRows);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [deleting, startDelete] = useTransition();

  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => (r.name ?? "").toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle) || r.source.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  // GHL-style: clicking a lead opens the full contact (with its conversation
  // inline). Leads without a linked CRM contact fall back to the detail popup.
  const openLead = (row: LeadRow) => {
    if (row.contactId) router.push(`/admin/crm/${row.contactId}`);
    else setSelectedModal(row);
  };

  const allChecked = visibleRows.length > 0 && visibleRows.every((r) => checked.has(r.id));
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) visibleRows.forEach((r) => next.delete(r.id));
      else visibleRows.forEach((r) => next.add(r.id));
      return next;
    });

  const bulkDelete = () => {
    const ids = [...checked];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} lead${ids.length === 1 ? "" : "s"}? They can be restored from Deleted leads.`)) return;
    startDelete(async () => {
      const res = await deleteLeads(ids);
      if (res.ok) {
        const gone = new Set(ids);
        setRows((prev) => prev.filter((r) => !gone.has(r.id)));
        setChecked(new Set());
      } else {
        window.alert(res.error || "Couldn't delete those leads. Please try again.");
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-line rounded-2xl shadow-sm p-6">
        <p className="text-sm text-muted">No leads yet. They&apos;ll appear here as people use the demo, chat, calculator, and scorecard.</p>
      </div>
    );
  }

  return (
    <>
      {/* Search */}
      <div className="relative mb-3 max-w-[360px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, source…"
          className="w-full rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors"
        />
      </div>

      {/* Owner-only bulk action bar */}
      {isOwner && checked.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-ink text-white rounded-xl px-4 py-2.5 mb-3">
          <span className="text-[13px] font-semibold">{checked.size} selected</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setChecked(new Set())} className="text-[13px] font-medium text-white/70 hover:text-white transition-colors">
              Clear
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-danger text-white rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Trash2 size={14} strokeWidth={2} />
              {deleting ? "Deleting…" : `Delete ${checked.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 border-b border-line">
                {isOwner && (
                  <th className="pl-5 pr-2 py-3 w-px">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" className="accent-brick w-4 h-4 align-middle cursor-pointer" />
                  </th>
                )}
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Automation</th>
                <th className="px-5 py-3">Detail</th>
                <th className="px-5 py-3 whitespace-nowrap">Date</th>
                <th className="px-5 py-3 w-px"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 7 : 6} className="px-5 py-10 text-center text-sm text-muted">No leads match “{q}”.</td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <tr key={row.id} onClick={() => openLead(row)} className="border-b border-[#F5F5F5] last:border-0 hover:bg-paper cursor-pointer transition-colors">
                  {isOwner && (
                    <td className="pl-5 pr-2 py-3 w-px" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(row.id)} onChange={() => toggleOne(row.id)} aria-label={`Select ${row.name || row.email}`} className="accent-brick w-4 h-4 align-middle cursor-pointer" />
                    </td>
                  )}
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
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openLead(row);
                      }}
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 bg-paper border border-line rounded-lg px-3 py-1.5 hover:bg-white hover:text-ink transition-colors"
                    >
                      <Eye size={14} strokeWidth={2} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div className="min-w-0">
                <div className="text-[18px] font-semibold text-ink truncate">{selected.name || "Lead"}</div>
                <a href={`mailto:${selected.email}`} className="text-[13.5px] text-brick hover:opacity-70 break-all">{selected.email}</a>
              </div>
              <button type="button" onClick={() => setSelectedModal(null)} aria-label="Close" className="text-muted-2 hover:text-ink text-xl leading-none">
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
              <button type="button" onClick={() => setSelectedModal(null)} className="text-[13px] font-semibold text-charcoal-2 px-4 py-2 rounded-lg hover:bg-paper transition-colors">
                Close
              </button>
              {selected.contactId && (
                <Link href={`/admin/crm/${selected.contactId}`} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark transition-colors">
                  Open full contact →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
