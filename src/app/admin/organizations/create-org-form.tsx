"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, Gift } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { createFreeOrganization, type CreateOrgState } from "./actions";

const initialState: CreateOrgState = { error: null };

export function CreateOrgButton() {
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [locations, setLocations] = useState<string[]>([""]);
  const [state, formAction, pending] = useActionState(createFreeOrganization, initialState);
  useCloseOnSuccess(pending, state.error, () => {
    setOpen(false);
    setOrgName("");
    setOwnerName("");
    setOwnerEmail("");
    setLocations([""]);
  });

  const validLocations = locations.map((l) => l.trim()).filter(Boolean);

  return (
    <>
      <Btn icon={Gift} onClick={() => setOpen(true)}>
        Create free account
      </Btn>
      {open && (
        <Modal
          title="Create a free account"
          sub="Sets up a new organization with no billing, and emails the owner an invite to set their password."
          onClose={() => setOpen(false)}
          wide
        >
          <form action={formAction}>
            <input type="hidden" name="locationNamesJson" value={JSON.stringify(validLocations)} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Organization name">
                <input name="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="Owner email">
                <input
                  type="email"
                  name="ownerEmail"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Owner full name">
              <input name="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required className={inputClass} />
            </Field>

            <label className="block text-[13px] font-semibold mb-1.5 text-ink">Locations</label>
            <div className="flex flex-col gap-2 mb-2">
              {locations.map((loc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={loc}
                    onChange={(e) => setLocations((ls) => ls.map((l, idx) => (idx === i ? e.target.value : l)))}
                    placeholder={`Location ${i + 1} name`}
                    className={`${inputClass} flex-1`}
                  />
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLocations((ls) => ls.filter((_, idx) => idx !== i))}
                      className="text-muted-2 hover:text-danger shrink-0"
                      aria-label="Remove location"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLocations((ls) => [...ls, ""])}
              className="flex items-center gap-1.5 text-sm font-semibold text-brick mt-1 mb-4"
            >
              <Plus size={15} /> Add another location
            </button>

            <div className="bg-olive-tint rounded-xl p-3.5 mb-4">
              <p className="text-xs text-[#15803d]">
                This account is marked <span className="font-semibold">free — no billing</span>, regardless of how many
                locations it has.
              </p>
            </div>

            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending || validLocations.length === 0}>
                {pending ? "Creating..." : "Create free account"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
