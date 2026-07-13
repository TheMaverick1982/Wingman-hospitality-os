"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { addStaffMember, type StaffFormState } from "./actions";

const initialState: StaffFormState = { error: null };

export function AddStaffButton({ locations, departments }: { locations: Location[]; departments: Department[] }) {
  const roles = departments.length ? departments : ALL_DEPARTMENTS;
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState<Department>(roles[0]);
  const [state, formAction, pending] = useActionState(addStaffMember, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));
  const multiLocation = locations.length > 1;

  return (
    <>
      <Btn small kind="ghost" icon={UserPlus} onClick={() => setOpen(true)}>
        Add staff
      </Btn>
      {open && (
        <Modal title="Add a staff member" onClose={() => setOpen(false)}>
          <form action={formAction}>
            {!multiLocation && <input type="hidden" name="locationId" value={locations[0]?.id ?? ""} />}
            <Field label="Full name">
              <input name="fullName" required className={inputClass} />
            </Field>
            <Field label="Role">
              <select
                name="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className={inputClass}
              >
                {roles.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            {multiLocation && (
              <Field label="Location">
                <select name="locationId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Select a location
                  </option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Email">
              <input type="email" name="email" required className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" required className={inputClass} />
            </Field>
            <p className="text-[12px] text-muted-2 -mt-1 mb-3">
              Email is how they&rsquo;ll log in to enter guest bounce-backs and see their training. Invite them to log in from Settings → Team once they&rsquo;re added.
            </p>

            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Adding..." : "Add staff member"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
