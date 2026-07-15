"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Trash2, History } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { AUDIT_ENTITY_LABELS, type AuditEntity } from "@/lib/audit-types";
import { restoreItem, purgeItem } from "./trash-actions";

export type TrashItem = { entity: AuditEntity; id: string; label: string; deletedAt: string | null; deletedByName: string };
export type AuditRow = { action: string; entityType: string; entityLabel: string; actorName: string; createdAt: string };

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const ACTION_STYLE: Record<string, string> = {
  deleted: "text-[#B42318] bg-[#FDECEA]",
  restored: "text-[#15803D] bg-[#E7F6EC]",
  purged: "text-charcoal-2 bg-paper",
};

export function TrashPanel({ items, audit }: { items: TrashItem[]; audit: AuditRow[] }) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ error: string | null }>, id: string) {
    setErr(null);
    setBusyId(id);
    start(async () => {
      const res = await fn();
      if (res.error) setErr(res.error);
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Trash</div>
        <p className="text-sm text-muted mb-5">
          Deleted guests, partners, and staff land here — recover anything a team member removed, or delete it for good.
          Only you (the account owner) can see and act on this.
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-muted">Trash is empty — nothing has been deleted.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {items.map((it) => (
              <div key={`${it.entity}-${it.id}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{it.label || "(untitled)"}</div>
                  <div className="text-xs text-muted-2">
                    {AUDIT_ENTITY_LABELS[it.entity]} · deleted {fmt(it.deletedAt)}
                    {it.deletedByName ? ` by ${it.deletedByName}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Btn small kind="ghost" icon={RotateCcw} disabled={pending && busyId === it.id} onClick={() => run(() => restoreItem(it.entity, it.id), it.id)}>
                    Restore
                  </Btn>
                  <button
                    type="button"
                    disabled={pending && busyId === it.id}
                    onClick={() => {
                      if (window.confirm(`Permanently delete "${it.label}"? This can't be undone.`)) run(() => purgeItem(it.entity, it.id), it.id);
                    }}
                    className="text-brick p-1.5 hover:opacity-70 disabled:opacity-40"
                    aria-label="Delete forever"
                    title="Delete forever"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {err && <p className="text-sm text-danger mt-3">{err}</p>}
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <History size={16} className="text-muted-2" />
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Recent activity</span>
        </div>
        <p className="text-sm text-muted mb-4">A log of who deleted, restored, or permanently removed records.</p>
        {audit.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {audit.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 text-sm text-charcoal-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-2 ${ACTION_STYLE[a.action] ?? "bg-paper text-muted-2"}`}>
                    {a.action}
                  </span>
                  <span className="text-ink font-medium">{a.entityLabel || "(untitled)"}</span>
                  <span className="text-muted-2"> · {AUDIT_ENTITY_LABELS[(a.entityType as AuditEntity)] ?? a.entityType}</span>
                  {a.actorName ? <span className="text-muted-2"> · by {a.actorName}</span> : ""}
                </div>
                <span className="text-xs text-muted-2 shrink-0 tabular-nums">{fmt(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
