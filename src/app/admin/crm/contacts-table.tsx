"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown } from "lucide-react";
import { sourceLabel, CRM_STAGES, type CrmStage } from "@/lib/crm";

export type ContactRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  stage: CrmStage;
  first_source: string | null;
  unsubscribed: boolean;
  tags: string[] | null;
  last_activity_at: string;
  created_at: string;
  fields: Record<string, unknown> | null;
};

const STAGE_STYLE: Partial<Record<CrmStage, string>> = {
  new: "bg-paper text-charcoal-2 border-line",
  engaged: "bg-blue-50 text-blue-700 border-blue-100",
  demoed: "bg-amber-50 text-amber-700 border-amber-100",
  demo_completed: "bg-amber-50 text-amber-700 border-amber-100",
  signed_up: "bg-olive-tint text-olive border-olive/20",
  past_client: "bg-purple-50 text-purple-700 border-purple-100",
  lost: "bg-red-50 text-red-600 border-red-100",
};
const STAGE_FALLBACK = "bg-paper text-charcoal-2 border-line";

// Smart lists are LIVE segments (filters), not static lists — membership updates
// automatically as a contact's stage changes. "Customers" holds everyone at the
// signed_up stage: they join on signup and drop off if their stage later moves.
const SMART_LISTS: { key: string; label: string; match: (c: ContactRow) => boolean }[] = [
  { key: "all", label: "All contacts", match: () => true },
  { key: "customers", label: "Customers", match: (c) => c.stage === "signed_up" },
  { key: "leads", label: "Active leads", match: (c) => c.stage === "new" || c.stage === "engaged" },
  { key: "demoed", label: "Demoed", match: (c) => c.stage === "demoed" || c.stage === "demo_completed" },
  { key: "past", label: "Past clients", match: (c) => c.stage === "past_client" },
  { key: "lost", label: "Lost", match: (c) => c.stage === "lost" },
];

// Contact tags are stored as src:*/aff:* internal labels — show them cleaned up.
function displayTag(tag: string): string {
  if (tag.startsWith("src:")) return sourceLabel(tag.slice(4));
  if (tag.startsWith("aff:")) return `Affiliate: ${tag.slice(4)}`;
  return tag;
}

function company(fields: Record<string, unknown> | null): string {
  const f = fields ?? {};
  const v = f.company ?? f.business_name ?? f.workspace_name;
  return typeof v === "string" ? v : "";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

type SortKey = "name" | "created_at" | "last_activity_at";

export function ContactsTable({ contacts }: { contacts: ContactRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [smart, setSmart] = useState("all");
  const [stage, setStage] = useState<"all" | CrmStage>("all");
  const [source, setSource] = useState<"all" | string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_activity_at");
  const [asc, setAsc] = useState(false);

  const listCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const sl of SMART_LISTS) m[sl.key] = contacts.filter(sl.match).length;
    return m;
  }, [contacts]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) if (c.first_source) s.add(c.first_source);
    return Array.from(s).sort();
  }, [contacts]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const smartMatch = SMART_LISTS.find((s) => s.key === smart)?.match ?? (() => true);
    let list = contacts.filter((c) => {
      if (!smartMatch(c)) return false;
      if (stage !== "all" && c.stage !== stage) return false;
      if (source !== "all" && c.first_source !== source) return false;
      if (!needle) return true;
      return (
        (c.name ?? "").toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle) ||
        (c.phone ?? "").toLowerCase().includes(needle) ||
        company(c.fields).toLowerCase().includes(needle)
      );
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (a.name ?? a.email).localeCompare(b.name ?? b.email);
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return asc ? cmp : -cmp;
    });
    return list;
  }, [contacts, q, smart, stage, source, sortKey, asc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "name"); // names default A→Z, dates default newest-first
    }
  };

  const SortHead = ({ label, k, className = "" }: { label: string; k: SortKey; className?: string }) => (
    <th className={`px-4 py-3 ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-ink transition-colors">
        {label}
        <ArrowUpDown size={12} className={sortKey === k ? "text-brick" : "text-muted-2/50"} />
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Smart lists (live segments) */}
      <div className="flex flex-wrap gap-1.5">
        {SMART_LISTS.map((sl) => {
          const active = smart === sl.key;
          return (
            <button
              key={sl.key}
              type="button"
              onClick={() => setSmart(sl.key)}
              className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                active ? "bg-ink text-white border-ink" : "bg-white text-charcoal-2 border-line hover:border-ink/30"
              }`}
            >
              {sl.label}
              <span className={`text-[11px] ${active ? "text-white/70" : "text-muted-2"}`}>{listCounts[sl.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors"
          />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value as "all" | CrmStage)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-charcoal-2 outline-none focus:border-brick">
          <option value="all">All stages</option>
          {CRM_STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-charcoal-2 outline-none focus:border-brick">
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{sourceLabel(s)}</option>
          ))}
        </select>
        <span className="text-[13px] text-muted-2 ml-auto whitespace-nowrap">{rows.length} of {contacts.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 border-b border-line">
                <SortHead label="Name" k="name" />
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Tags</th>
                <SortHead label="Created" k="created_at" className="whitespace-nowrap" />
                <SortHead label="Last activity" k="last_activity_at" className="whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const tags = (c.tags ?? []).map(displayTag);
                return (
                  <tr key={c.id} onClick={() => router.push(`/admin/crm/${c.id}`)} className="border-b border-[#F5F5F5] last:border-0 hover:bg-paper cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[14px] font-semibold text-ink">{c.name || "—"}</div>
                      <div className="text-[12.5px] text-muted-2">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-charcoal-2 whitespace-nowrap">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-charcoal-2">{company(c.fields) || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full">{sourceLabel(c.first_source)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full border capitalize ${STAGE_STYLE[c.stage] ?? STAGE_FALLBACK}`}>
                        {CRM_STAGES.find((s) => s.key === c.stage)?.label ?? c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {tags.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-[11px] font-medium text-olive bg-olive-tint px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
                        ))}
                        {tags.length > 3 && <span className="text-[11px] text-muted-2">+{tags.length - 3}</span>}
                        {tags.length === 0 && <span className="text-[13px] text-muted-2">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-2 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-2 whitespace-nowrap">{timeAgo(c.last_activity_at)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No contacts match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
