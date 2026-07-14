"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Download, Megaphone, Clock, Heart } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { RetentionChart } from "@/components/dashboard/retention-chart";
import { computeStageCounts, stageOf, visitAt, type GuestWithVisits } from "@/lib/hospitality";
import { analyzeRetention, locationDropoff, locationInsight } from "@/lib/retention-coach";
import { computeGuestRevenue } from "@/lib/guest-revenue";
import type { Location } from "@/lib/data/locations";
import { GuestModal, type GuestFormValue } from "./guest-modal";
import { CsvImportButton } from "./csv-import-button";
import { RetentionCoach } from "./retention-coach";
import { deleteGuest } from "./actions";
import { downloadCsv } from "@/lib/csv";

type Guest = GuestWithVisits & { phone: string; email: string; name: string };

const REACTION_META = [
  { key: "wowed" as const, label: "Wowed", desc: "a story worth telling", color: "#16A34A" },
  { key: "delighted" as const, label: "Delighted", desc: "noticeably cared for", color: "#0A6CFF" },
  { key: "neutral" as const, label: "Neutral", desc: "served, not moved", color: "#D4D4D4" },
  { key: "let_down" as const, label: "Let down", desc: "recovery needed", color: "#DC2626" },
];

function daysSince(dateStr: string, now: number): number {
  return Math.floor((now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// Most recent visit date across a guest's visits (ISO YYYY-MM-DD sorts lexically).
function lastVisitOf(visits: { visit_date: string | null }[]): string | null {
  const dates = visits.map((v) => v.visit_date).filter(Boolean) as string[];
  return dates.length ? dates.sort().at(-1)! : null;
}

// Format a YYYY-MM-DD date without timezone drift (parse the parts, not the string).
function fmtVisitDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function GuestsClient({
  guests,
  locations,
  defaultLocationId,
  canEdit,
  scopedLocationName,
}: {
  guests: Guest[];
  locations: Location[];
  defaultLocationId: string | null;
  canEdit: boolean;
  scopedLocationName: string | null;
}) {
  const [search, setSearch] = useState("");
  const [modalGuest, setModalGuest] = useState<GuestFormValue | null | undefined>(undefined);
  const [now] = useState(() => Date.now());

  const stageCounts = useMemo(() => computeStageCounts(guests), [guests]);

  // Retention drop-off coach: where are we losing the most guests, and (across
  // locations) is one store dragging it down?
  const retention = useMemo(() => analyzeRetention(stageCounts.counts), [stageCounts]);
  const retentionLocationInsight = useMemo(
    () => (retention.worst ? locationInsight(locationDropoff(guests, locations, retention.worst.fromVisit)) : null),
    [guests, locations, retention.worst]
  );

  // Actual revenue captured, by visit stage — real bill totals, not estimates.
  const revenue = useMemo(() => computeGuestRevenue(guests), [guests]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) => g.name.toLowerCase().includes(q) || g.phone.includes(q) || g.email.toLowerCase().includes(q)
    );
  }, [guests, search]);

  const allVisits = useMemo(() => guests.flatMap((g) => g.guest_visits), [guests]);
  const reactionCounts = useMemo(() => {
    const counts = { wowed: 0, delighted: 0, neutral: 0, let_down: 0 };
    for (const v of allVisits) {
      if (v.reaction) counts[v.reaction] += 1;
    }
    return counts;
  }, [allVisits]);
  const positiveReactions = reactionCounts.wowed + reactionCounts.delighted;
  const flatReactions = reactionCounts.neutral + reactionCounts.let_down;
  const totalReactions = positiveReactions + flatReactions;
  const reactionRatio = flatReactions > 0 ? (positiveReactions / flatReactions).toFixed(1) : positiveReactions > 0 ? "∞" : "—";

  const referralCount = useMemo(() => guests.filter((g) => g.referred_a_friend).length, [guests]);
  const referralRate = guests.length > 0 ? Math.round((referralCount / guests.length) * 100) : 0;

  const avgVisits = useMemo(() => {
    if (guests.length === 0) return "0.0";
    const total = guests.reduce((s, g) => s + g.guest_visits.filter((v) => v.visit_date).length, 0);
    return (total / guests.length).toFixed(1);
  }, [guests]);

  const atRisk = useMemo(
    () =>
      guests.filter((g) => {
        const stage = stageOf(g.guest_visits);
        if (stage === 0 || stage >= 4) return false;
        const last = visitAt(g.guest_visits, stage)?.visit_date;
        return last ? daysSince(last, now) >= 30 : false;
      }),
    [guests, now]
  );

  const wonBack = useMemo(
    () =>
      guests.filter((g) => stageOf(g.guest_visits) >= 2 && g.guest_visits.some((v) => v.visit_number > 1 && v.incentive)).length,
    [guests]
  );

  // Win-back list: at-risk guests, most-stale first, so a manager can act.
  const winBackList = useMemo(() => {
    return atRisk
      .map((g) => {
        const stage = stageOf(g.guest_visits);
        const last = visitAt(g.guest_visits, stage)?.visit_date;
        return { guest: g, days: last ? daysSince(last, now) : 0, stage };
      })
      .sort((a, b) => b.days - a.days);
  }, [atRisk, now]);

  // Ready to refer: guests who had a genuinely positive reaction (the NPS-style
  // "promoters") and haven't referred anyone yet -- the ones to actually ask.
  const readyToRefer = useMemo(
    () =>
      guests.filter(
        (g) =>
          !g.referred_a_friend &&
          g.guest_visits.some((v) => v.reaction === "wowed" || v.reaction === "delighted")
      ),
    [guests]
  );

  const funnel = useMemo(() => {
    const [c1, c2, c3, c4] = stageCounts.counts;
    return [
      { stage: "Visit 1 → 2", pct: c1 > 0 ? Math.round((c2 / c1) * 100) : 0 },
      { stage: "Visit 2 → 3", pct: c2 > 0 ? Math.round((c3 / c2) * 100) : 0 },
      { stage: "Visit 3 → 4", pct: c3 > 0 ? Math.round((c4 / c3) * 100) : 0 },
    ];
  }, [stageCounts]);

  function exportContacts() {
    downloadCsv(
      "guest-bounce-back.csv",
      ["Guest", "Phone", "Email", "Visits", "Stage", "Last location", "Referred a friend"],
      filtered.map((g) => {
        const stage = stageOf(g.guest_visits);
        const lastLocationId = visitAt(g.guest_visits, stage)?.location_id;
        return [
          g.name,
          g.phone,
          g.email,
          g.guest_visits.filter((v) => v.visit_date).length,
          stage,
          locations.find((l) => l.id === lastLocationId)?.name ?? "",
          g.referred_a_friend ? "Yes" : "No",
        ];
      })
    );
  }

  function openEdit(g: Guest) {
    const visits: GuestFormValue["visits"] = {};
    for (const v of g.guest_visits) {
      visits[v.visit_number] = {
        visit_date: v.visit_date,
        location_id: v.location_id,
        incentive: v.incentive ?? "",
        notes: v.notes ?? "",
        reaction: v.reaction ?? "",
        bill_total: v.bill_total ?? null,
      };
    }
    setModalGuest({
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      visits,
      referred_a_friend: g.referred_a_friend,
    });
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Turn first visits into regulars</h1>
          {scopedLocationName ? (
            <p className="text-base text-muted">
              Guests whose first visit was at <span className="font-semibold text-ink">{scopedLocationName}</span>. Switch to{" "}
              <span className="font-semibold text-ink">All locations</span> up top to see everyone.
            </p>
          ) : (
            <p className="text-base text-muted">
              Every guest, tracked across <span className="font-semibold text-ink">all locations</span> — because a
              regular at one is a first-timer at another.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <CsvImportButton locations={locations} />
          <Btn icon={Plus} onClick={() => setModalGuest(null)}>
            Log New Guest
          </Btn>
        </div>
      </div>

      <RetentionCoach analysis={retention} locationInsight={retentionLocationInsight} canEdit={canEdit} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Repeat rate" value={`${stageCounts.pct[1] || 0}%`} sub="back for visit 2" />
        <StatTile label="Avg. visits / guest" value={avgVisits} sub="across tracked guests" />
        <StatTile label="At risk of churn" value={atRisk.length} sub="no visit in 30+ days" trend={atRisk.length > 0 ? "Needs action" : undefined} trendTone="down" />
        <StatTile label="Won back" value={wonBack} sub="via bounce-back offers" />
      </div>

      {(winBackList.length > 0 || readyToRefer.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-[#D97706]" />
              <span className="text-[15px] font-semibold text-ink">Win these guests back</span>
              <span className="ml-auto text-xs font-semibold text-muted-2 tabular-nums">{winBackList.length}</span>
            </div>
            <div className="text-[13px] text-muted mb-3">Gone quiet 30+ days — reach out with a reason to return.</div>
            {winBackList.length === 0 ? (
              <p className="text-sm text-muted">No one&apos;s slipping right now. Nice.</p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {winBackList.slice(0, 5).map(({ guest, days }) => (
                  <button
                    key={guest.id}
                    onClick={() => openEdit(guest)}
                    className="flex items-center justify-between gap-3 py-2.5 text-left hover:opacity-70 transition-opacity"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{guest.name}</div>
                      <div className="text-xs text-muted truncate">{guest.phone || guest.email || "No contact on file"}</div>
                    </div>
                    <span className="text-xs font-semibold text-[#B45309] shrink-0 tabular-nums">{days}d quiet</span>
                  </button>
                ))}
                {winBackList.length > 5 && (
                  <div className="pt-2.5 text-xs text-muted-2">+ {winBackList.length - 5} more below</div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Heart size={16} className="text-[#16A34A]" />
              <span className="text-[15px] font-semibold text-ink">Ready to ask for a referral</span>
              <span className="ml-auto text-xs font-semibold text-muted-2 tabular-nums">{readyToRefer.length}</span>
            </div>
            <div className="text-[13px] text-muted mb-3">They were wowed or delighted — now&apos;s the moment to ask.</div>
            {readyToRefer.length === 0 ? (
              <p className="text-sm text-muted">Log some reactions to surface your happiest guests here.</p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {readyToRefer.slice(0, 5).map((guest) => (
                  <button
                    key={guest.id}
                    onClick={() => openEdit(guest)}
                    className="flex items-center justify-between gap-3 py-2.5 text-left hover:opacity-70 transition-opacity"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{guest.name}</div>
                      <div className="text-xs text-muted truncate">{guest.phone || guest.email || "No contact on file"}</div>
                    </div>
                    <span className="text-xs font-semibold text-[#15803D] shrink-0">Promoter</span>
                  </button>
                ))}
                {readyToRefer.length > 5 && (
                  <div className="pt-2.5 text-xs text-muted-2">+ {readyToRefer.length - 5} more</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Visit funnel</div>
          <div className="text-[13px] text-muted mb-6">Where guests drop off — and where they stick.</div>
          <div className="flex flex-col gap-3.5">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium text-ink">{f.stage}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink">{f.pct}%</span>
                </div>
                <div className="h-3 rounded-full bg-[#F1F1F1] overflow-hidden">
                  <div className="h-full rounded-full bg-brick" style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Guest retention</div>
          <div className="text-[13px] text-muted mt-0.5 mb-2">Cumulative visits, out of {stageCounts.total} tracked</div>
          <RetentionChart counts={stageCounts.counts} labels={["Visit 1", "Visit 2", "Visit 3", "Visit 4"]} />
        </div>
      </div>

      {revenue.billedVisits > 0 && (
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Revenue by visit</div>
              <div className="text-[13px] text-muted mt-0.5 max-w-[420px]">
                Actual bill totals logged at each visit. The repeat visits are the revenue your bounce-back work brought back.
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[26px] font-bold tracking-[-0.02em] leading-none text-[#15803D] tabular-nums">
                  {money(revenue.repeatRevenue)}
                </div>
                <div className="text-xs text-muted-2 mt-1">repeat-visit revenue</div>
              </div>
              <div className="text-right">
                <div className="text-[26px] font-bold tracking-[-0.02em] leading-none text-ink tabular-nums">
                  {money(revenue.total)}
                </div>
                <div className="text-xs text-muted-2 mt-1">total logged</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {revenue.byVisit.map((v) => {
              const maxTotal = Math.max(...revenue.byVisit.map((x) => x.total), 1);
              const pct = Math.round((v.total / maxTotal) * 100);
              return (
                <div key={v.visit} className="bg-[#FAFAFA] rounded-[14px] p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[13px] font-semibold text-charcoal-2">Visit {v.visit}</span>
                    <span className="text-[11.5px] text-muted-2 tabular-nums">{v.count}</span>
                  </div>
                  <div className="text-[19px] font-bold text-ink tabular-nums leading-none">{money(v.total)}</div>
                  <div className="h-1.5 rounded-full bg-line overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${v.visit === 1 ? "bg-charcoal-2" : "bg-[#16A34A]"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11.5px] text-muted-2 mt-2">{v.avg > 0 ? `${money(v.avg)} avg` : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Reactions created</div>
              <div className="text-[13px] text-muted mt-0.5 max-w-[320px]">
                Guests remember how you made them feel — not the transaction.
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[32px] font-bold tracking-[-0.02em] leading-none text-[#16A34A]">{reactionRatio}:1</div>
              <div className="text-xs text-muted-2 mt-1">positive to flat</div>
            </div>
          </div>
          {totalReactions > 0 && (
            <div className="flex h-3 rounded-full overflow-hidden my-5 gap-0.5">
              {REACTION_META.map((r) => {
                const pct = (reactionCounts[r.key] / totalReactions) * 100;
                return pct > 0 ? <div key={r.key} style={{ width: `${pct}%`, background: r.color }} /> : null;
              })}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {REACTION_META.map((r) => (
              <div key={r.key} className="flex items-center gap-2.5">
                <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: r.color }} />
                <span className="text-sm font-medium flex-1">{r.label}</span>
                <span className="text-[13px] text-muted">{r.desc}</span>
                <span className="text-sm font-semibold tabular-nums w-[42px] text-right">{reactionCounts[r.key]}</span>
              </div>
            ))}
          </div>
          {totalReactions === 0 && <p className="text-sm text-muted mt-3">No reactions logged yet.</p>}
        </div>

        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Raving fans</div>
              <div className="text-[13px] text-muted mt-0.5 max-w-[320px]">
                Satisfied guests don&apos;t refer. Raving fans do.
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[32px] font-bold tracking-[-0.02em] leading-none text-ink">{referralRate}%</div>
              <div className="text-xs text-muted-2 mt-1">referral rate</div>
            </div>
          </div>
          <div className="mt-5 px-4 py-3.5 rounded-[10px] bg-brick-tint flex items-center justify-between">
            <span className="text-[13px] text-brick-dark font-semibold">
              {referralCount} of {guests.length} tracked guests referred a friend
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg max-w-md w-full bg-white border border-line">
          <Search size={15} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests by name, email, or phone..."
            className="text-sm outline-none w-full bg-transparent text-ink"
          />
        </div>
        <Btn small kind="ghost" icon={Download} onClick={exportContacts}>
          Export contacts
        </Btn>
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-line">
              {["Guest", "Contact", "Current Stage", "Last visit", "Latest Incentive", "Location", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => {
              const stage = stageOf(g.guest_visits);
              const latest = visitAt(g.guest_visits, stage)?.incentive;
              const lastVisit = lastVisitOf(g.guest_visits);
              const visitLocationIds = [...new Set(g.guest_visits.map((v) => v.location_id).filter(Boolean))] as string[];
              const firstLocationId = visitAt(g.guest_visits, 1)?.location_id ?? visitLocationIds[0];
              const firstLocationName = locations.find((l) => l.id === firstLocationId)?.name ?? "—";
              const extraLocationCount = visitLocationIds.filter((id) => id !== firstLocationId).length;
              const status =
                stage >= 4
                  ? { label: "Regular", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]", dot: "bg-[#16A34A]" }
                  : stage >= 2
                    ? { label: "In progress", fg: "text-brick-dark", bg: "bg-brick-tint", dot: "bg-brick" }
                    : { label: "First visit", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]", dot: "bg-[#D97706]" };
              return (
                <tr key={g.id} className="border-b border-line hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-5 py-3.5 text-ink">
                    <div className="flex items-center gap-1.5">
                      {g.name}
                      {g.referred_a_friend && <Megaphone size={12} className="text-gold" />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{g.phone || g.email || "—"}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill label={`${status.label} · Visit ${stage} of 4`} fg={status.fg} bg={status.bg} dot={status.dot} />
                  </td>
                  <td className={`px-5 py-3.5 tabular-nums ${lastVisit ? "text-muted" : "text-muted-2"}`}>
                    {lastVisit ? fmtVisitDate(lastVisit) : "—"}
                  </td>
                  <td className={`px-5 py-3.5 ${latest ? "text-ink" : "text-muted"}`}>{latest || "None recorded"}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {firstLocationName}
                    {extraLocationCount > 0 && <span className="text-gold"> + {extraLocationCount}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <Btn small kind="ghost" icon={Pencil} onClick={() => openEdit(g)}>
                        Edit
                      </Btn>
                      <button onClick={() => deleteGuest(g.id)} className="text-brick">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center">
                  {guests.length === 0 ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-muted">No guests yet — log your first to start tracking who comes back.</p>
                      <Btn icon={Plus} onClick={() => setModalGuest(null)}>Log your first guest</Btn>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No guests match your search.</p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {modalGuest !== undefined && (
        <GuestModal
          guest={modalGuest}
          locations={locations}
          defaultLocationId={defaultLocationId}
          onClose={() => setModalGuest(undefined)}
        />
      )}
    </>
  );
}
