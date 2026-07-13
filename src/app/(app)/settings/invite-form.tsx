"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { inviteTeamMember, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function InviteTeamMemberButton({ locations, departments }: { locations: Location[]; departments: Department[] }) {
  const roles = departments.length ? departments : ALL_DEPARTMENTS;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  const multiLocation = locations.length > 1;
  const [role, setRole] = useState<"manager" | "staff" | "super_admin">("manager");
  const [scope, setScope] = useState<"all" | "specific">("specific");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(locations[0] ? [locations[0].id] : []));

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isSuperAdmin = role === "super_admin";

  return (
    <>
      <Btn icon={UserPlus} onClick={() => setOpen(true)}>
        Invite team member
      </Btn>
      {open && (
        <Modal title="Invite a team member" sub="They'll get an email invite to set their password and join." onClose={() => setOpen(false)}>
          <form action={formAction}>
            <input type="hidden" name="scope" value={scope} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name">
                <input name="fullName" required className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Job role">
                <select name="department" defaultValue={roles[0]} className={inputClass}>
                  {roles.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Access level">
                <select
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "manager" | "staff" | "super_admin")}
                  className={inputClass}
                >
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                  <option value="super_admin">Super Admin (co-owner)</option>
                </select>
              </Field>
            </div>
            <p className="text-[12px] text-muted-2 -mt-1 mb-3">
              Job role sets their training &amp; metrics; access level sets what they can see and edit. They&rsquo;ll appear on your Staff page automatically.
            </p>

            {isSuperAdmin ? (
              <p className="text-[13px] text-muted mb-4">
                A Super Admin has full access to every location and to Settings — treat this like a co-owner.
              </p>
            ) : !multiLocation ? (
              <>
                {locations[0] && <input type="hidden" name="locationIds" value={locations[0].id} />}
              </>
            ) : (
              <div className="mb-4">
                <div className="text-sm font-semibold text-ink mb-2">Location access</div>
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input type="radio" name="scopeRadio" checked={scope === "all"} onChange={() => setScope("all")} className="accent-brick" />
                  <span className="text-ink">All locations</span>
                </label>
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="radio"
                    name="scopeRadio"
                    checked={scope === "specific"}
                    onChange={() => setScope("specific")}
                    className="accent-brick"
                  />
                  <span className="text-ink">Specific locations</span>
                </label>
                {scope === "specific" && (
                  <div className="mt-1 ml-6 flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                    {locations.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="locationIds"
                          value={l.id}
                          checked={checked.has(l.id)}
                          onChange={() => toggle(l.id)}
                          className="accent-brick"
                        />
                        <span className="text-charcoal-2">{l.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

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
