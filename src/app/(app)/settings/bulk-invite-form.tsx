"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Location } from "@/lib/data/locations";
import { bulkInviteTeamMembers, type BatchState } from "./actions";

const initialState: BatchState = { error: null, successCount: 0, failures: [] };

type Row = { fullName: string; email: string; role: "manager" | "staff"; locationId: string };

export function BulkInviteButton({ locations }: { locations: Location[] }) {
  const [open, setOpen] = useState(false);
  const emptyRow = (): Row => ({ fullName: "", email: "", role: "manager", locationId: locations[0]?.id ?? "" });
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [state, formAction, pending] = useActionState(bulkInviteTeamMembers, initialState);
  useCloseOnSuccess(pending, state.error, () => {
    setOpen(false);
    setRows([emptyRow()]);
  });

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  const validRows = rows.filter((r) => r.fullName.trim() && r.email.trim());

  return (
    <>
      <Btn small kind="ghost" icon={Users} onClick={() => setOpen(true)}>
        Bulk invite
      </Btn>
      {open && (
        <Modal title="Bulk invite team members" sub="Invite several people at once — each gets their own email invite." onClose={() => setOpen(false)} wide>
          <form action={formAction}>
            <input type="hidden" name="membersJson" value={JSON.stringify(validRows)} />

            <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1 mb-1">
              {rows.map((row, i) => (
                <div key={i} className="border border-line rounded-xl p-4 relative">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                      className="absolute top-3 right-3 text-muted-2 hover:text-danger"
                      aria-label="Remove row"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Full name">
                      <input value={row.fullName} onChange={(e) => updateRow(i, "fullName", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={row.email} onChange={(e) => updateRow(i, "email", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Access level">
                      <select value={row.role} onChange={(e) => updateRow(i, "role", e.target.value)} className={inputClass}>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    </Field>
                    <Field label="Location">
                      <select value={row.locationId} onChange={(e) => updateRow(i, "locationId", e.target.value)} className={inputClass}>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRows((r) => [...r, emptyRow()])}
              className="flex items-center gap-1.5 text-sm font-semibold text-brick mt-2 mb-4"
            >
              <Plus size={15} /> Add another person
            </button>

            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            {state.failures.length > 0 && (
              <ul className="text-xs text-danger mb-2 list-disc pl-4">
                {state.failures.map((f) => (
                  <li key={f.index}>
                    Row {f.index + 1}: {f.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending || validRows.length === 0}>
                {pending ? "Sending invites..." : `Send ${validRows.length || ""} invite${validRows.length === 1 ? "" : "s"}`}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
