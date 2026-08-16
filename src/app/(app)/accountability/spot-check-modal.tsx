"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { StarRating } from "@/components/ui/star-rating";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS, SPOT_CHECK_DIMENSIONS } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { addSpotCheck, type ActionState } from "./actions";
import { networkSafeAction, NETWORK_ERROR_MESSAGE } from "@/lib/network-safe-action";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

type StaffOption = { full_name: string; department: string };

export function SpotCheckModalButton({
  locations,
  isGm,
  lockedLocationName,
  defaultLocationId,
  staff = [],
  departmentOptions,
}: {
  locations: Location[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
  staff?: StaffOption[];
  departmentOptions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(networkSafeAction(addSpotCheck, (s) => ({ ...s, error: NETWORK_ERROR_MESSAGE })), initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  // Only offer the roles this org actually runs (falls back to all).
  const depts = departmentOptions && departmentOptions.length > 0 ? departmentOptions : [...ALL_DEPARTMENTS];

  // Staff member: pick from the roster (auto-fills their department), or type a
  // name if they're not listed yet.
  const [staffName, setStaffName] = useState("");
  const [dept, setDept] = useState<string>(depts[0]);
  const [manual, setManual] = useState(staff.length === 0);

  return (
    <>
      <Btn icon={Star} onClick={() => setOpen(true)}>
        Log spot-check
      </Btn>
      {open && (
        <Modal title="Log a spot-check" sub="&quot;Did that feel like a transaction, or an experience?&quot;" onClose={() => setOpen(false)} wide>
          <form action={formAction}>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Staff member">
                {/* The submitted value — a select/text drives it. */}
                <input type="hidden" name="staffName" value={staffName} />
                {manual ? (
                  <input
                    autoFocus
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Type a name"
                    className={inputClass}
                  />
                ) : (
                  <select
                    value={staffName}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__other") {
                        setManual(true);
                        setStaffName("");
                        return;
                      }
                      setStaffName(v);
                      const s = staff.find((x) => x.full_name === v);
                      if (s) setDept(s.department);
                    }}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Select staff…
                    </option>
                    {staff.map((s) => (
                      <option key={`${s.full_name}-${s.department}`} value={s.full_name}>
                        {s.full_name} — {s.department}
                      </option>
                    ))}
                    <option value="__other">Other (type a name)…</option>
                  </select>
                )}
                {manual && staff.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setManual(false);
                      setStaffName("");
                    }}
                    className="text-[12px] font-semibold text-brick mt-1 hover:opacity-70"
                  >
                    ← Pick from roster
                  </button>
                )}
              </Field>
              <Field label="Department">
                <select name="department" value={dept} onChange={(e) => setDept(e.target.value)} className={inputClass}>
                  {depts.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
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
            <Field label="Date">
              <input type="date" name="occurredOn" defaultValue={today()} required className={inputClass} />
            </Field>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {SPOT_CHECK_DIMENSIONS.map((d, i) => (
                <div key={d}>
                  <label className="text-xs font-medium block mb-1 leading-tight text-muted">{d}</label>
                  <StarRating name={`score_${i}`} />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" name="feltLikeTransaction" className="accent-brick" />
              <span className="text-sm text-charcoal-2">Felt like a transaction, not an experience — flag to run again</span>
            </label>
            <Field label="Coaching notes">
              <textarea name="notes" rows={2} className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending || !staffName.trim()}>
                {pending ? "Saving..." : "Save spot-check"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
