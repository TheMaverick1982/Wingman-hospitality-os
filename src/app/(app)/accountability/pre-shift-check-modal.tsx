"use client";

import { useActionState, useState } from "react";
import { Sunrise } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { addPreShiftCheck, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

export function PreShiftCheckModalButton({
  locations,
  isGm,
  lockedLocationName,
  defaultLocationId,
  items,
}: {
  locations: Location[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
  items: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addPreShiftCheck, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn kind="ghost" icon={Sunrise} onClick={() => setOpen(true)}>
        Pre-shift check
      </Btn>
      {open && (
        <Modal title="Pre-shift hospitality check" sub="A quick readiness check, per person, before the shift starts." onClose={() => setOpen(false)}>
          <form action={formAction}>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Staff member">
                <input name="staffName" required className={inputClass} />
              </Field>
              <Field label="Department">
                <select name="department" defaultValue={ALL_DEPARTMENTS[1]} className={inputClass}>
                  {ALL_DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                {isGm ? (
                  <select name="locationId" defaultValue={defaultLocationId ?? ""} required className={inputClass}>
                    <option value="" disabled>
                      Select a location
                    </option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input type="hidden" name="locationId" value={defaultLocationId ?? ""} />
                    <input disabled value={lockedLocationName ?? ""} className={`${inputClass} opacity-70`} />
                  </>
                )}
              </Field>
            </div>
            <Field label="Date">
              <input type="date" name="occurredOn" defaultValue={today()} required className={inputClass} />
            </Field>
            <input type="hidden" name="itemCount" value={items.length} />
            <div className="flex flex-col gap-2.5 mb-4">
              {items.map((item, i) => (
                <label key={i} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name={`item_${i}`} className="mt-1 accent-brick" />
                  <span className="text-sm leading-relaxed text-charcoal-2">{item}</span>
                </label>
              ))}
            </div>
            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save check"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
