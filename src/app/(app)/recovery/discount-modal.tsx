"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { DISCOUNT_CATEGORIES } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { StaffPicker, type StaffOption } from "@/components/staff-picker";
import { addDiscount, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

export function DiscountModalButton({
  locations,
  staff,
  isGm,
  lockedLocationName,
  defaultLocationId,
}: {
  locations: Location[];
  staff: StaffOption[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addDiscount, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn icon={Plus} onClick={() => setOpen(true)}>
        Log Discount
      </Btn>
      {open && (
        <Modal
          title="Log discount"
          sub="Every comp gets a reason. Discounts are a symptom, not the problem."
          onClose={() => setOpen(false)}
        >
          <form action={formAction}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date">
                <input type="date" name="occurredOn" defaultValue={today()} required className={inputClass} />
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
            <Field label="Server">
              <StaffPicker name="serverName" staff={staff} department="Server" required placeholder="Server name" />
            </Field>
            <Field label="Category">
              <select name="category" defaultValue={DISCOUNT_CATEGORIES[0]} className={inputClass}>
                {DISCOUNT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reason">
                <input name="reason" required className={inputClass} />
              </Field>
              <Field label="Amount ($)">
                <input type="number" name="amount" step="0.01" required className={inputClass} />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea name="notes" rows={2} className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Logging..." : "Log discount"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
