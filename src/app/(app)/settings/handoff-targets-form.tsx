"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import type { Location } from "@/lib/data/locations";
import { addHandoffTarget, removeHandoffTarget, type ActionState } from "./partner-goals-actions";

export type HandoffTarget = { id: string; label: string; location_id: string | null };

const initialState: ActionState = { error: null };

// Owner-managed list of people/departments a partner contact can be "handed off
// to" — a company-wide default set plus optional per-location entries. The
// Partners contact form reads this list for its "Handed off to" dropdown.
export function HandoffTargetsForm({ targets, locations }: { targets: HandoffTarget[]; locations: Location[] }) {
  const [state, formAction, pending] = useActionState(addHandoffTarget, initialState);
  const [removing, startRemove] = useTransition();

  const orgWide = targets.filter((t) => t.location_id === null);
  const perLocation = targets.filter((t) => t.location_id !== null);

  const Chip = ({ t }: { t: HandoffTarget }) => (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1 rounded-full bg-paper border border-line text-charcoal-2">
      {t.label}
      <button
        type="button"
        onClick={() => startRemove(async () => void (await removeHandoffTarget(t.id)))}
        disabled={removing}
        className="text-muted-2 hover:text-brick disabled:opacity-40"
        aria-label={`Remove ${t.label}`}
      >
        <X size={13} />
      </button>
    </span>
  );

  return (
    <div className="bg-white border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-ink">Hand-off targets</h3>
      <p className="text-sm text-muted mt-1 mb-4">
        Who a partner contact can be handed off to — a manager or a department. These fill the “Handed off to” dropdown when
        your team logs a contact. Add company-wide names, or scope one to a single location.
      </p>

      {orgWide.length > 0 && (
        <div className="mb-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1.5">Company-wide</div>
          <div className="flex flex-wrap gap-2">{orgWide.map((t) => <Chip key={t.id} t={t} />)}</div>
        </div>
      )}

      {perLocation.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {locations
            .filter((l) => perLocation.some((t) => t.location_id === l.id))
            .map((l) => (
              <div key={l.id}>
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1.5">{l.name}</div>
                <div className="flex flex-wrap gap-2">
                  {perLocation.filter((t) => t.location_id === l.id).map((t) => <Chip key={t.id} t={t} />)}
                </div>
              </div>
            ))}
        </div>
      )}

      {targets.length === 0 && <p className="text-[13px] text-muted-2 mb-3">No hand-off targets yet — add your first below.</p>}

      <form action={formAction} className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-line">
        <input name="label" placeholder="Name or department (e.g. Carla, Events)" className={`${inputClass} flex-1`} required />
        <select name="location_id" defaultValue="" className={`${inputClass} sm:w-48`} aria-label="Scope">
          <option value="">Company-wide</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <Btn type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Btn>
      </form>
      {state.error && <p className="text-sm text-brick mt-2">{state.error}</p>}
    </div>
  );
}
