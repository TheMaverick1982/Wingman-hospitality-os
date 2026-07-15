"use client";

import { useActionState, useEffect, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import type { Location } from "@/lib/data/locations";
import { DEFAULT_GOALS } from "@/lib/partners";
import { updatePartnerGoals, type ActionState } from "./partner-goals-actions";

const initialState: ActionState = { error: null };

export type GoalRow = {
  location_id: string | null;
  goal_new_contacts: number;
  goal_events: number;
  goal_fundraisers: number;
  goal_active_connections: number;
};

const numClass = `${inputClass} text-center`;

// Owner-only Partners goals editor: an org-wide default plus optional per-store
// overrides (blank inherits the default). Standing targets — set once, they
// apply every quarter until changed.
export function PartnerGoalsForm({ orgDefault, byLocation, locations }: { orgDefault: GoalRow | null; byLocation: Record<string, GoalRow>; locations: Location[] }) {
  const [state, formAction, pending] = useActionState(updatePartnerGoals, initialState);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const def = orgDefault ?? { location_id: null, ...DEFAULT_GOALS };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Quarterly goals</div>
        <p className="text-sm text-muted mb-5">
          Targets each store aims for every quarter. Set a default for all stores; override any store below. These
          drive the goal-progress cards and the monthly Partners report.
        </p>

        <div className="rounded-xl border border-line overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-line text-left">
                {["Store", "New contacts", "Events", "Fundraisers", "Active (keep warm)"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line bg-brick-tint/30">
                <td className="px-4 py-3 font-semibold text-ink">All stores (default)</td>
                <td className="px-4 py-2">
                  <input name="default_new" type="number" min="0" defaultValue={def.goal_new_contacts} className={numClass} />
                </td>
                <td className="px-4 py-2">
                  <input name="default_events" type="number" min="0" defaultValue={def.goal_events} className={numClass} />
                </td>
                <td className="px-4 py-2">
                  <input name="default_fundraisers" type="number" min="0" defaultValue={def.goal_fundraisers} className={numClass} />
                </td>
                <td className="px-4 py-2">
                  <input name="default_active" type="number" min="0" defaultValue={def.goal_active_connections} className={numClass} />
                </td>
              </tr>
              {locations.map((l) => {
                const o = byLocation[l.id];
                return (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">
                      {l.name}
                      <input type="hidden" name="location_id" value={l.id} />
                    </td>
                    <td className="px-4 py-2">
                      <input name={`loc_${l.id}_new`} type="number" min="0" defaultValue={o?.goal_new_contacts ?? ""} placeholder={String(def.goal_new_contacts)} className={numClass} />
                    </td>
                    <td className="px-4 py-2">
                      <input name={`loc_${l.id}_events`} type="number" min="0" defaultValue={o?.goal_events ?? ""} placeholder={String(def.goal_events)} className={numClass} />
                    </td>
                    <td className="px-4 py-2">
                      <input name={`loc_${l.id}_fundraisers`} type="number" min="0" defaultValue={o?.goal_fundraisers ?? ""} placeholder={String(def.goal_fundraisers)} className={numClass} />
                    </td>
                    <td className="px-4 py-2">
                      <input name={`loc_${l.id}_active`} type="number" min="0" defaultValue={o?.goal_active_connections ?? ""} placeholder={String(def.goal_active_connections)} className={numClass} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-2 mt-3">Leave a store&apos;s cells blank to use the default (shown as the faint number).</p>

        {state.error && <p className="text-sm text-brick mt-3">{state.error}</p>}
        <div className="flex items-center gap-3 mt-5">
          <Btn type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save goals"}
          </Btn>
          {saved && <span className="text-sm font-semibold text-[#15803D]">Saved ✓</span>}
        </div>
      </div>
    </form>
  );
}
