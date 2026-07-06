"use client";

import { useActionState } from "react";
import { Modal } from "@/components/ui/modal";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { saveGuest, type ActionState } from "./actions";
import type { Location } from "@/lib/data/locations";

export type GuestVisitFormValue = {
  visit_date: string | null;
  location_id: string | null;
  incentive: string;
  notes: string;
};

export type GuestFormValue = {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: Record<number, GuestVisitFormValue | undefined>;
};

const initialState: ActionState = { error: null };

export function GuestModal({
  guest,
  locations,
  defaultLocationId,
  onClose,
}: {
  guest: GuestFormValue | null;
  locations: Location[];
  defaultLocationId: string | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveGuest, initialState);
  useCloseOnSuccess(pending, state.error, onClose);

  return (
    <Modal
      title={guest ? "Update guest" : "Log new guest"}
      sub="Record visits, incentives, and notes across the 4-visit lifecycle. Shared across all locations — a guest may return somewhere else."
      onClose={onClose}
      wide
    >
      <form action={formAction}>
        {guest && <input type="hidden" name="guestId" value={guest.id} />}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Full name</span>
            <input name="name" defaultValue={guest?.name} required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Phone</span>
            <input name="phone" defaultValue={guest?.phone} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm mb-4">
          <span className="font-semibold text-ink">Email</span>
          <input name="email" defaultValue={guest?.email} className={inputClass} />
        </label>

        {[1, 2, 3, 4].map((n) => {
          const v = guest?.visits?.[n];
          return (
            <div key={n} className="bg-white border border-line rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-brick text-white font-mono">
                  {n}
                </span>
                <span className="text-sm font-semibold text-ink">
                  Visit {n}
                  {n === 1 ? " (Initial)" : n === 4 ? " (Loyal)" : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium block mb-1 text-muted">Date visited</label>
                  <input
                    type="date"
                    name={`visit_${n}_date`}
                    defaultValue={v?.visit_date ?? ""}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1 text-muted">Location</label>
                  <select
                    name={`visit_${n}_location`}
                    defaultValue={v?.location_id ?? defaultLocationId ?? ""}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1 text-muted">
                    What was given to bring them back?
                  </label>
                  <input
                    name={`visit_${n}_incentive`}
                    defaultValue={v?.incentive ?? ""}
                    placeholder="e.g. Free Detroit Bianco"
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="text-xs font-medium block mb-1 text-muted">Notes</label>
              <textarea
                name={`visit_${n}_notes`}
                defaultValue={v?.notes ?? ""}
                rows={1}
                placeholder="Experience feedback, what they ordered, etc."
                className={inputClass}
              />
            </div>
          );
        })}

        {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <Btn type="button" kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save guest"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
