"use client";

import { useActionState, useState } from "react";
import { Sparkle } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { StarRating } from "@/components/ui/star-rating";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { AMBIANCE_DIMENSIONS } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { addAmbianceCheck, type ActionState } from "./actions";
import { networkSafeAction, NETWORK_ERROR_MESSAGE } from "@/lib/network-safe-action";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

export function AmbianceCheckModalButton({
  locations,
  isGm,
  lockedLocationName,
  defaultLocationId,
}: {
  locations: Location[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(networkSafeAction(addAmbianceCheck, (s) => ({ ...s, error: NETWORK_ERROR_MESSAGE })), initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn kind="ghost" icon={Sparkle} onClick={() => setOpen(true)}>
        Ambiance check
      </Btn>
      {open && (
        <Modal title="Ambiance / first impression check" sub="What a guest notices in the first 10 seconds." onClose={() => setOpen(false)} wide>
          <form action={formAction}>
            <div className="grid grid-cols-2 gap-4">
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
              <Field label="Date">
                <input type="date" name="occurredOn" defaultValue={today()} required className={inputClass} />
              </Field>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {AMBIANCE_DIMENSIONS.map((d, i) => (
                <div key={d} className="flex items-center justify-between gap-4 bg-panel border border-line rounded-xl px-4 py-2.5">
                  <label className="text-sm font-medium text-ink leading-tight">{d}</label>
                  <StarRating name={`score_${i}`} />
                </div>
              ))}
            </div>
            <Field label="Notes">
              <textarea name="notes" rows={2} className={inputClass} />
            </Field>
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
