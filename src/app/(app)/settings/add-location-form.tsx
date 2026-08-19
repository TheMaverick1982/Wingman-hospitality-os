"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { US_TIMEZONES, guessTimezoneFromAddress, browserTimezoneOrDefault } from "@/lib/us-timezones";
import { bulkAddLocations, type BatchState } from "./actions";

const initialState: BatchState = { error: null, successCount: 0, failures: [] };

// tzTouched: once the operator picks a zone by hand we stop auto-overwriting it
// from the address, so their choice sticks.
type Row = { name: string; address: string; phone: string; email: string; timezone: string; tzTouched: boolean };

function emptyRow(): Row {
  return { name: "", address: "", phone: "", email: "", timezone: browserTimezoneOrDefault(), tzTouched: false };
}

export function AddLocationForm({
  currentLocationCount,
  isFreeAccount,
  firstDollars = 399,
  addlDollars = 149,
}: {
  currentLocationCount: number;
  isFreeAccount?: boolean;
  firstDollars?: number;
  addlDollars?: number;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [state, formAction, pending] = useActionState(bulkAddLocations, initialState);
  useCloseOnSuccess(pending, state.error, () => {
    setOpen(false);
    setRows([emptyRow()]);
  });

  function updateRow(i: number, field: "name" | "address" | "phone" | "email", value: string) {
    setRows((r) =>
      r.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, [field]: value };
        // Auto-detect the store's time zone from the address as they type — until
        // they pick one by hand (tzTouched), then their choice wins.
        if (field === "address" && !row.tzTouched) {
          const guess = guessTimezoneFromAddress(value);
          if (guess) next.timezone = guess;
        }
        return next;
      }),
    );
  }

  function setRowTimezone(i: number, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, timezone: value, tzTouched: true } : row)));
  }

  const validRows = rows.filter((r) => r.name.trim());
  const payload = validRows.map((r) => ({ name: r.name, address: r.address, phone: r.phone, email: r.email, timezone: r.timezone }));
  const newTotal = currentLocationCount + validRows.length;
  const currentMonthly = currentLocationCount > 0 ? firstDollars + (currentLocationCount - 1) * addlDollars : 0;
  const nextMonthly = newTotal > 0 ? firstDollars + (newTotal - 1) * addlDollars : 0;

  return (
    <>
      <Btn small kind="ghost" icon={Building2} onClick={() => setOpen(true)}>
        Add locations
      </Btn>
      {open && (
        <Modal title="Add locations" sub="Add one location or several at once." onClose={() => setOpen(false)} wide>
          <form action={formAction}>
            <input type="hidden" name="locationsJson" value={JSON.stringify(payload)} />

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
                    <div className="col-span-2">
                      <Field label="Time zone (for reports, activity & interview times)">
                        <select value={row.timezone} onChange={(e) => setRowTimezone(i, e.target.value)} className={inputClass}>
                          {US_TIMEZONES.map(([v, label]) => (
                            <option key={v} value={v}>{label}</option>
                          ))}
                        </select>
                      </Field>
                      <p className="text-[12px] text-muted-2 mt-1">
                        {row.tzTouched
                          ? "Set manually."
                          : row.address && guessTimezoneFromAddress(row.address)
                            ? "Auto-detected from the address — change it if it's off."
                            : "Add the address (with state) and we'll set this for you, or pick it here."}
                      </p>
                    </div>
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
