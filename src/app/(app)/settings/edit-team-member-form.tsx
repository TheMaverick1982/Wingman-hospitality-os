"use client";

import { useActionState, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Location } from "@/lib/data/locations";
import { editTeamMember, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

type Role = "super_admin" | "manager" | "staff";

export function EditTeamMemberForm({
  member,
  locations,
}: {
  member: {
    id: string;
    full_name: string;
    access_role: Role;
    all_locations: boolean;
    accessibleLocationIds: string[];
  };
  locations: Location[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(editTeamMember, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  const multiLocation = locations.length > 1;
  const [role, setRole] = useState<Role>(member.access_role);
  const [scope, setScope] = useState<"all" | "specific">(member.all_locations ? "all" : "specific");
  const [checked, setChecked] = useState<Set<string>>(
    () =>
      new Set(
        member.accessibleLocationIds.length > 0
          ? member.accessibleLocationIds
          : member.all_locations || !locations[0]
          ? []
          : [locations[0].id]
      )
  );

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70"
      >
        Edit
      </button>
      {open && (
        <Modal
          title="Edit team member"
          sub="Update their name, access level, and which locations they can access."
          onClose={() => setOpen(false)}
        >
          <form action={formAction}>
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="scope" value={scope} />
            <Field label="Full name">
              <input name="fullName" required defaultValue={member.full_name} className={inputClass} />
            </Field>
            <Field label="Access level">
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={inputClass}
              >
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="super_admin">Super Admin (co-owner — full access)</option>
              </select>
            </Field>

            {isSuperAdmin ? (
              <p className="text-[13px] text-muted mb-4">
                A Super Admin has full access to every location and to Settings — treat this like a co-owner.
              </p>
            ) : !multiLocation ? (
              <>{locations[0] && <input type="hidden" name="locationIds" value={locations[0].id} />}</>
            ) : (
              <div className="mb-4">
                <div className="text-sm font-semibold text-ink mb-2">Location access</div>
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="radio"
                    name="scopeRadio"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    className="accent-brick"
                  />
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
                {pending ? "Saving…" : "Save changes"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
