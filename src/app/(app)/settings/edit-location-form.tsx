"use client";

import { useActionState, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { updateLocation, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

type LocationDetails = { id: string; name: string; address: string; phone: string; email: string };

export function EditLocationForm({ location }: { location: LocationDetails }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateLocation, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70"
      >
        Edit
      </button>
      {open && (
        <Modal title="Edit location" sub="Update this location's details." onClose={() => setOpen(false)}>
          <form action={formAction}>
            <input type="hidden" name="id" value={location.id} />
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="Location name">
                <input name="name" defaultValue={location.name} className={inputClass} />
              </Field>
              <Field label="Store email">
                <input name="email" type="email" defaultValue={location.email} className={inputClass} />
              </Field>
              <Field label="Address">
                <input name="address" defaultValue={location.address} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="phone" type="tel" defaultValue={location.phone} className={inputClass} />
              </Field>
            </div>

            {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
