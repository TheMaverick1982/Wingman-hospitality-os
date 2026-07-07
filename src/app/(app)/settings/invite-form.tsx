"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Location } from "@/lib/data/locations";
import { inviteTeamMember, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function InviteTeamMemberButton({ locations }: { locations: Location[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn icon={UserPlus} onClick={() => setOpen(true)}>
        Invite team member
      </Btn>
      {open && (
        <Modal title="Invite a team member" sub="They'll get an email invite to set their password and join." onClose={() => setOpen(false)}>
          <form action={formAction}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name">
                <input name="fullName" required className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Access level">
                <select name="role" defaultValue="manager" className={inputClass}>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              </Field>
              <Field label="Location">
                <select name="locationId" defaultValue={locations[0]?.id ?? ""} required className={inputClass}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Sending invite..." : "Send invite"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
