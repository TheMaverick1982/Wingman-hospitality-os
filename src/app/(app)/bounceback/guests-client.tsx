"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Download, Heart, Megaphone } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Pill } from "@/components/ui/pill";
import { StageCard } from "@/components/ui/stage-card";
import { computeStageCounts, stageOf, visitAt, type GuestWithVisits } from "@/lib/hospitality";
import type { Location } from "@/lib/data/locations";
import { GuestModal, type GuestFormValue } from "./guest-modal";
import { deleteGuest } from "./actions";
import { downloadCsv } from "@/lib/csv";

type Guest = GuestWithVisits & { phone: string; email: string; name: string };

export function GuestsClient({
  guests,
  locations,
  defaultLocationId,
}: {
  guests: Guest[];
  locations: Location[];
  defaultLocationId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [modalGuest, setModalGuest] = useState<GuestFormValue | null | undefined>(undefined);

  const stageCounts = useMemo(() => computeStageCounts(guests), [guests]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.phone.includes(q) ||
        g.email.toLowerCase().includes(q)
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
  const reactionRatio = flatReactions > 0 ? (positiveReactions / flatReactions).toFixed(1) : positiveReactions > 0 ? "∞" : "—";
  const totalReactions = positiveReactions + flatReactions;

  const referralCount = useMemo(() => guests.filter((g) => g.referred_a_friend).length, [guests]);
  const referralRate = guests.length > 0 ? Math.round((referralCount / guests.length) * 100) : 0;

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
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Guest Bounce Back</h1>
          <p className="text-sm text-muted">
            Track return visits and measure the success of comeback incentives. Shared across every
            location — a guest can return anywhere.
          </p>
        </div>
        <Btn icon={Plus} onClick={() => setModalGuest(null)}>
          Log New Guest
        </Btn>
      </div>

      <div className="flex gap-4 mb-6">
        <StageCard label="Visit 1 (Initial)" pct={stageCounts.pct[0] || 0} sub={`${stageCounts.counts[0] || 0} / ${stageCounts.total} guests tracked`} />
        <StageCard label="Visit 2" pct={stageCounts.pct[1] || 0} sub={`${stageCounts.counts[1] || 0} reached stage 2`} />
        <StageCard label="Visit 3" pct={stageCounts.pct[2] || 0} sub={`${stageCounts.counts[2] || 0} reached stage 3`} />
        <StageCard label="Visit 4 (Loyal)" pct={stageCounts.pct[3] || 0} sub={`${stageCounts.counts[3] || 0} reached stage 4`} active />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-panel border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-brick" />
              <h3 className="font-display text-lg font-semibold text-ink">Reactions created</h3>
            </div>
            <span className="font-mono text-xl font-bold text-olive">{reactionRatio}:1</span>
          </div>
          <p className="text-xs text-muted mb-4">Guests remember how you made them feel — not the transaction.</p>
          {totalReactions === 0 ? (
            <p className="text-sm text-muted">No reactions logged yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {[
                { key: "wowed" as const, label: "Wowed", tone: "olive" as const },
                { key: "delighted" as const, label: "Delighted", tone: "brick" as const },
                { key: "neutral" as const, label: "Neutral", tone: "muted" as const },
                { key: "let_down" as const, label: "Let down", tone: "danger" as const },
              ].map((r) => (
                <div key={r.key} className="flex items-center justify-between text-sm">
                  <Pill dot tone={r.tone}>{r.label}</Pill>
                  <span className="font-mono text-ink">{reactionCounts[r.key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-panel border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-gold" />
              <h3 className="font-display text-lg font-semibold text-ink">Raving fans</h3>
            </div>
            <span className="font-mono text-xl font-bold text-ink">{referralRate}%</span>
          </div>
          <p className="text-xs text-muted mb-4">Satisfied guests don&apos;t refer. Raving fans do.</p>
          <p className="text-sm text-charcoal-2">
            <b className="text-ink">{referralCount}</b> of {guests.length} tracked guests referred a friend.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg max-w-md w-full bg-panel border border-line">
          <Search size={15} className="text-muted" />
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

      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-line">
              {["Guest", "Contact", "Current Stage", "Latest Incentive", "Location", ""].map((h) => (
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
              const visitLocationIds = [...new Set(g.guest_visits.map((v) => v.location_id).filter(Boolean))] as string[];
              const firstLocationId = visitAt(g.guest_visits, 1)?.location_id ?? visitLocationIds[0];
              const firstLocationName = locations.find((l) => l.id === firstLocationId)?.name ?? "—";
              const extraLocationCount = visitLocationIds.filter((id) => id !== firstLocationId).length;
              return (
                <tr key={g.id} className="border-b border-line hover:bg-[#fafafa] transition-colors">
                  <td className="px-5 py-3.5 text-ink">
                    <div className="flex items-center gap-1.5">
                      {g.name}
                      {g.referred_a_friend && <Megaphone size={12} className="text-gold" />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{g.phone || g.email || "—"}</td>
                  <td className="px-5 py-3.5">
                    <Pill dot tone={stage >= 4 ? "olive" : stage >= 2 ? "gold" : "muted"}>Visit {stage} of 4</Pill>
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
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  No guests match. Log your first guest to start tracking.
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
    </div>
  );
}
