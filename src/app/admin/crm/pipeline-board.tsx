"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { sourceLabel, type CrmStage } from "@/lib/crm";
import { moveContactStage } from "./actions";

export type BoardContact = {
  id: string;
  email: string;
  name: string | null;
  stage: CrmStage;
  first_source: string | null;
  unsubscribed: boolean;
  last_activity_at: string;
};

function initials(name: string | null, email: string): string {
  const base = (name || email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function PipelineBoard({ contacts, stages }: { contacts: BoardContact[]; stages: { key: CrmStage; label: string }[] }) {
  const [items, setItems] = useState<BoardContact[]>(contacts);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<CrmStage, BoardContact[]>();
    for (const s of stages) map.set(s.key, []);
    for (const c of items) (map.get(c.stage) ?? map.set(c.stage, []).get(c.stage)!).push(c);
    return map;
  }, [items, stages]);

  async function drop(stage: CrmStage) {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const contact = items.find((c) => c.id === id);
    if (!contact || contact.stage === stage) return;
    const prev = items;
    setItems((list) => list.map((c) => (c.id === id ? { ...c, stage, last_activity_at: new Date().toISOString() } : c)));
    const res = await moveContactStage(id, stage);
    if (!res.ok) setItems(prev); // revert on failure
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stages.map((s) => {
        const list = byStage.get(s.key) ?? [];
        return (
          <div
            key={s.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(s.key);
            }}
            onDragLeave={() => setOverStage((cur) => (cur === s.key ? null : cur))}
            onDrop={() => drop(s.key)}
            className={`w-[268px] shrink-0 rounded-2xl border p-2.5 transition-colors ${
              overStage === s.key ? "border-brick bg-brick-tint/40" : "border-line bg-paper"
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[13px] font-semibold text-ink">{s.label}</span>
              <span className="text-[12px] font-semibold text-muted-2 bg-white border border-line rounded-full px-2 py-0.5">{list.length}</span>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {list.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/crm/${c.id}`}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                  className="block bg-white border border-line rounded-xl p-3 shadow-sm hover:border-brick/50 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-[11px] font-semibold">
                      {initials(c.name, c.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-ink truncate">{c.name || c.email}</div>
                      <div className="text-[12px] text-muted-2 truncate">{c.name ? c.email : sourceLabel(c.first_source)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[11px] font-medium text-charcoal-2 bg-paper border border-line rounded-full px-2 py-0.5">
                      {sourceLabel(c.first_source)}
                    </span>
                    <span className="text-[11px] text-muted-2">{timeAgo(c.last_activity_at)}</span>
                  </div>
                </Link>
              ))}
              {list.length === 0 && <div className="text-[12px] text-muted-2 px-2 py-3 text-center">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
