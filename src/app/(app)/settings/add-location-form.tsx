"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { bulkAddLocations, type BatchState } from "./actions";

const initialState: BatchState = { error: null, successCount: 0, failures: [] };

type Row = { name: string; address: string; phone: string; email: string };

function emptyRow(): Row {
  return { name: "", address: "", phone: "", email: "" };
}

export function AddLocationForm({
  currentLocationCount,
  isFreeAccount,
}: {
  currentLocationCount: number;
  isFreeAccount?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [state, formAction, pending] = useActionState(bulkAddLocations, initialState);
  useCloseOnSuccess(pending, state.error, () => {
    setOpen(false);
    setRows([emptyRow()]);
  });

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  const validRows = rows.filter((r) => r.name.trim());
  const newTotal = currentLocationCount + validRows.length;
  const currentMonthly = currentLocationCount > 0 ? 199 + (currentLocationCount - 1) * 100 : 0;
  const nextMonthly = newTotal > 0 ? 199 + (newTotal - 1) * 100 : 0;

  return (
    <>
      <Btn small kind="ghost" icon={Building2} onClick={() => setOpen(true)}>
        Add locations
      </Btn>
      {open && (
        <Modal title="Add locations" sub="Add one location or several at once." onClose={() => setOpen(false)} wide>
          <form action={formAction}>
            <input type="hidden" name="locationsJson" value={JSON.stringify(validRows)} />

            <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1 mb-1">
              {rows.map((row, i) => (
                <div key={i} className="border border-line rounded-xl p-4 relative">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                      className="absolute top-3 right-3 text-muted-2 hover:text-danger"
                      aria-label="Remove location"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Location name">
                      <input value={row.name} onChange={(e) => updateRow(i, "name", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Store email">
                      <input type="email" value={row.email} onChange={(e) => updateRow(i, "email", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Address">
                      <input value={row.address} onChange={(e) => updateRow(i, "address", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" value={row.phone} onChange={(e) => updateRow(i, "phone", e.target.value)} className={inputClass} />
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
              <Plus size={15} /> Add another location
            </button>

            {validRows.length > 0 && (
              <div className="bg-paper border border-line rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between text-sm gap-3 flex-wrap">
                  <span className="text-muted">
                    Adding {validRows.length} location{validRows.length === 1 ? "" : "s"} — {currentLocationCount} → {newTotal} total
                  </span>
                  {!isFreeAccount && (
                    <span className="font-semibold text-ink tabular-nums">
                      ${currentMonthly}/mo → ${nextMonthly}/mo
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-2 mt-1.5">
                  {isFreeAccount
                    ? "This is a free account — no billing, no matter how many locations you add."
                    : "Billing updates automatically once a payment method is connected — see the Billing tab."}
                </p>
              </div>
            )}

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
                {pending
                  ? "Adding..."
                  : `Confirm & add ${validRows.length || ""} location${validRows.length === 1 ? "" : "s"}`}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
