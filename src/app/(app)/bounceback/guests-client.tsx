"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Pill } from "@/components/ui/pill";
import { StageCard } from "@/components/ui/stage-card";
import { computeStageCounts, stageOf, visitAt, type GuestWithVisits } from "@/lib/hospitality";
import type { Location } from "@/lib/data/locations";
import { GuestModal, type GuestFormValue } from "./guest-modal";
import { deleteGuest } from "./actions";

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

  function openEdit(g: Guest) {
    const visits: GuestFormValue["visits"] = {};
    for (const v of g.guest_visits) {
      visits[v.visit_number] = {
        visit_date: v.visit_date,
        location_id: v.location_id,
        incentive: v.incentive ?? "",
        notes: v.notes ?? "",
      };
    }
    setModalGuest({ id: g.id, name: g.name, phone: g.phone, email: g.email, visits });
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

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 max-w-md bg-panel border border-line">
        <Search size={15} className="text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guests by name, email, or phone..."
          className="text-sm outline-none w-full bg-transparent text-ink"
        />
      </div>

      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-line">
              {["Guest", "Contact", "Current Stage", "Latest Incentive", "Last Location", ""].map((h) => (
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
              const visitLocationIds = g.guest_visits.map((v) => v.location_id).filter(Boolean);
              const distinctLocations = new Set(visitLocationIds);
              const traveled = distinctLocations.size > 1;
              const lastLocationId = visitAt(g.guest_visits, stage)?.location_id;
              const lastLocationName = locations.find((l) => l.id === lastLocationId)?.name;
              return (
                <tr key={g.id} className="border-b border-line hover:bg-[#fafafa] transition-colors">
                  <td className="px-5 py-3.5 text-ink">{g.name}</td>
                  <td className="px-5 py-3.5 text-muted">{g.phone || g.email || "—"}</td>
                  <td className="px-5 py-3.5">
                    <Pill dot tone={stage >= 4 ? "olive" : stage >= 2 ? "gold" : "muted"}>Visit {stage} of 4</Pill>
                  </td>
                  <td className={`px-5 py-3.5 ${latest ? "text-ink" : "text-muted"}`}>{latest || "None recorded"}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {lastLocationName || "—"}
                    {traveled && <span className="text-gold"> · travels</span>}
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
