"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare } from "lucide-react";
import { ConversationStar } from "./conversation-star";
import type { ConversationRow } from "@/lib/conversations";

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
type Tab = "unread" | "all" | "recent" | "starred";

export function InboxList({ rows }: { rows: ConversationRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      unread: rows.filter((r) => r.unread).length,
      all: rows.length,
      recent: rows.filter((r) => r.lastMessageAt && now - new Date(r.lastMessageAt).getTime() < WEEK).length,
      starred: rows.filter((r) => r.starred).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (tab === "unread") return rows.filter((r) => r.unread);
    if (tab === "starred") return rows.filter((r) => r.starred);
    if (tab === "recent") return rows.filter((r) => r.lastMessageAt && now - new Date(r.lastMessageAt).getTime() < WEEK);
    return rows;
  }, [rows, tab]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "unread", label: "Unread" },
    { key: "all", label: "All" },
    { key: "recent", label: "Recent" },
    { key: "starred", label: "Starred" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = tab === t.key;
          const n = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                active ? "border-brick text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {n > 0 && (
                <span className={`text-[11px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${t.key === "unread" ? "bg-brick text-white" : "bg-paper text-muted-2 border border-line"}`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          {tab === "unread" ? "No unread conversations. 🎉" : tab === "starred" ? "No starred conversations yet." : tab === "recent" ? "Nothing in the last 7 days." : "No conversations yet. They appear here once you email or text a contact — or one texts you back."}
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-hidden divide-y divide-line">
          {filtered.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/admin/conversations/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/admin/conversations/${r.id}`);
              }}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper transition-colors cursor-pointer"
            >
              <ConversationStar contactId={r.id} starred={r.starred} />
              {r.unread ? <span className="w-2 h-2 rounded-full bg-brick shrink-0" /> : <span className="w-2 h-2 shrink-0" />}
              <span className="shrink-0 text-muted-2">
                {r.lastKind.startsWith("sms") ? <MessageSquare size={15} /> : <Mail size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm truncate ${r.unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>{r.name || r.email}</span>
                  <span className="text-[12px] text-muted-2 whitespace-nowrap shrink-0">{whenLabel(r.lastMessageAt)}</span>
                </div>
                <div className="text-[13px] text-muted truncate">{r.preview || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
