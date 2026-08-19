"use client";

import { useMemo, useState, useTransition } from "react";
import { LogIn, UserPlus, UserMinus, Pencil, Trash2, Plus, Users, Activity, Loader2 } from "lucide-react";
import { formatInZone } from "@/lib/timezone";
import { loadMoreActivityAction } from "./actions";

export type ActivityRow = {
  id: string;
  actorId: string | null;
  actorName: string;
  area: string;
  action: string;
  label: string;
  createdAt: string;
  // The zone to show this entry's time in (the actor's location) — see listActivity.
  timezone: string | null;
};

const AREA_LABEL: Record<string, string> = {
  auth: "Login",
  guests: "Guests",
  partners: "Partners",
  training: "Training",
  staff: "Team",
  checklists: "Checklists",
  settings: "Settings",
};

function iconFor(area: string, action: string) {
  if (action === "login") return LogIn;
  if (action === "invited") return UserPlus;
  if (action === "removed") return UserMinus;
  if (action === "deleted") return Trash2;
  if (action === "created" || action === "added") return Plus;
  return Pencil;
}

function phrase(r: ActivityRow): string {
  const area = AREA_LABEL[r.area] ?? r.area;
  if (r.action === "login") return "Signed in";
  const verb =
    r.action === "created" ? "added" :
    r.action === "updated" ? "edited" :
    r.action === "deleted" ? "deleted" :
    r.action === "invited" ? "invited" :
    r.action === "removed" ? "removed" : r.action;
  const noun = { guests: "guest", partners: "partner contact", training: "training test", staff: "team member" }[r.area] ?? area.toLowerCase();
  return `${verb} ${noun}${r.label ? ` “${r.label}”` : ""}`;
}

function dayKey(iso: string, tz: string | null): string {
  // Group by the calendar day in the entry's own zone, so a late-evening action
  // doesn't jump to "tomorrow" just because it's past midnight UTC.
  return formatInZone(iso, tz, { weekday: "short", month: "short", day: "numeric" }, false);
}

export function StaffActivityPanel({ rows: initialRows, staff, initialHasMore = false }: { rows: ActivityRow[]; staff: { id: string; name: string }[]; initialHasMore?: boolean }) {
  const [who, setWho] = useState("");
  const [area, setArea] = useState("");
  const [rows, setRows] = useState<ActivityRow[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, start] = useTransition();
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadMore = () => {
    setLoadErr(null);
    start(async () => {
      const r = await loadMoreActivityAction(rows.length);
      if (r.error) { setLoadErr(r.error); return; }
      // Guard against any duplicate on the page boundary.
      const seen = new Set(rows.map((x) => x.id));
      setRows((prev) => [...prev, ...r.rows.filter((x) => !seen.has(x.id))]);
      setHasMore(r.hasMore);
    });
  };

  const filtered = useMemo(
    () => rows.filter((r) => (!who || r.actorId === who) && (!area || r.area === area)),
    [rows, who, area],
  );

  const groups = useMemo(() => {
    const m = new Map<string, ActivityRow[]>();
    for (const r of filtered) {
      const k = dayKey(r.createdAt, r.timezone);
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return [...m.entries()];
  }, [filtered]);

  const areas = [...new Set(rows.map((r) => r.area))];

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={16} className="text-brick" />
        <h3 className="font-display text-lg font-semibold text-ink">Staff activity</h3>
      </div>
      <p className="text-sm text-muted mb-4">Logins and edits across your account — who did what, and where. Only the account owner can see this.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-muted-2" />
          <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brick">
            <option value="">Everyone</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brick">
          <option value="">All areas</option>
          {areas.map((a) => <option key={a} value={a}>{AREA_LABEL[a] ?? a}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-2 py-6 text-center">No activity yet{who || area ? " for this filter" : ""}.</div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-2">{day}</div>
              <div className="flex flex-col gap-2">
                {items.map((r) => {
                  const Icon = iconFor(r.area, r.action);
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-paper flex items-center justify-center shrink-0"><Icon size={14} className="text-charcoal-2" /></div>
                      <div className="flex-1 min-w-0 text-[13.5px]">
                        <span className="font-semibold text-ink">{r.actorName || "Someone"}</span>{" "}
                        <span className="text-charcoal-2">{phrase(r)}</span>
                      </div>
                      <span className="text-[12px] text-muted-2 shrink-0 tabular-nums">{formatInZone(r.createdAt, r.timezone, { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {loadErr && <div className="text-[13px] text-danger mt-4">{loadErr}</div>}
      {hasMore && (
        <div className="mt-5 flex items-center justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick disabled:opacity-50"
          >
            {pending ? <><Loader2 size={14} className="animate-spin" /> Loading…</> : "Load older activity"}
          </button>
        </div>
      )}
      {(who || area) && hasMore && (
        <p className="text-[11.5px] text-muted-2 text-center mt-2">Filters apply to loaded activity. Load older activity to search further back.</p>
      )}
    </div>
  );
}
