"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StarRating } from "@/components/ui/star-rating";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS, RECOMMENDATION_OPTIONS, type Department } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { addCandidate, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

export function CandidateModalButton({
  coreValueTitles,
  traitsByDept,
  locations,
  isGm,
  lockedLocationName,
  defaultLocationId,
  defaultDepartment,
}: {
  coreValueTitles: string[];
  traitsByDept: Record<Department, string[]>;
  locations: Location[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
  defaultDepartment: Department;
}) {
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState<Department>(defaultDepartment);
  const [recommendation, setRecommendation] = useState<(typeof RECOMMENDATION_OPTIONS)[number]>("Unsure");
  const [state, formAction, pending] = useActionState(addCandidate, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  const combinedTraits = [
    ...coreValueTitles.map((title) => ({ title, universal: true })),
    ...traitsByDept[department].map((title) => ({ title, universal: false })),
  ];

  return (
    <>
      <Btn icon={Plus} onClick={() => setOpen(true)}>
        Score a candidate
      </Btn>
      {open && (
        <Modal title="Score a candidate" sub="Against your actual values, not a generic rubric." onClose={() => setOpen(false)} wide>
          <form action={formAction}>
            <input type="hidden" name="recommendation" value={recommendation} />
            <div className="grid grid-cols-3 gap-4">
              <Field label="Candidate name">
                <input name="name" required className={inputClass} />
              </Field>
              <Field label="Department applying for">
                <select
                  name="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className={inputClass}
                >
                  {ALL_DEPARTMENTS.map((d) => (
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

            <div key={department} className="flex flex-col gap-3 mb-4">
              {combinedTraits.map((t, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-2xl border ${t.universal ? "border-line" : "border-[#ffcc80]"} bg-white`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill tone={t.universal ? "brick" : "gold"}>{t.universal ? "Universal" : department}</Pill>
                      <span className="text-sm font-semibold text-ink">{t.title}</span>
                    </div>
                    <StarRating name={`score_${i}`} />
                  </div>
                </div>
              ))}
            </div>

            <Field label="Overall recommendation">
              <div className="flex gap-2 flex-wrap">
                {RECOMMENDATION_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRecommendation(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      recommendation === r ? "bg-charcoal text-white border-charcoal" : "bg-white text-ink border-line"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Notes">
              <textarea name="notes" rows={2} placeholder="What specific story or moment stood out?" className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save scorecard"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
