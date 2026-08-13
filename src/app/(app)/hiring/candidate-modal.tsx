"use client";

import { useActionState, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, MessageSquareText, Check, X } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StarRating } from "@/components/ui/star-rating";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ALL_DEPARTMENTS, RECOMMENDATION_OPTIONS, type Department } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import { StaffPicker, type StaffOption } from "@/components/staff-picker";
import { addCandidate, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

export type ScoreTrait = {
  title: string;
  question: string | null;
  green_flag: string | null;
  red_flag: string | null;
};

export function CandidateModalButton({
  universalTraits,
  traitsByDept,
  locations,
  staff,
  isGm,
  lockedLocationName,
  defaultLocationId,
  defaultDepartment,
  departments,
  autoOpenDepartment,
  prefillName,
  applicationId,
}: {
  universalTraits: ScoreTrait[];
  traitsByDept: Record<Department, ScoreTrait[]>;
  locations: Location[];
  staff: StaffOption[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
  defaultDepartment: Department;
  departments?: Department[];
  autoOpenDepartment?: Department;
  // When starting from an application: prefill the name and link back on save.
  prefillName?: string;
  applicationId?: string;
}) {
  const roles = departments && departments.length ? departments : ALL_DEPARTMENTS;
  // Auto-open (and preselect the department) when arriving with score/apply
  // params — derived from props at mount, so no state-syncing effect needed.
  const [open, setOpen] = useState(Boolean(autoOpenDepartment || prefillName));
  const [department, setDepartment] = useState<Department>(autoOpenDepartment ?? defaultDepartment);
  const [recommendation, setRecommendation] = useState<(typeof RECOMMENDATION_OPTIONS)[number]>("Unsure");
  const [showGuide, setShowGuide] = useState(true);
  const [state, formAction, pending] = useActionState(addCandidate, initialState);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Close the modal and strip the score-request params from the URL (keeping any
  // location filter), so it doesn't reopen on reload and scoring the SAME
  // interview again re-triggers the remount that opens it.
  function closeModal() {
    setOpen(false);
    const SCORE_KEYS = ["app", "an", "scoreDept", "scoreLoc"];
    if (SCORE_KEYS.some((k) => searchParams.has(k))) {
      const next = new URLSearchParams(searchParams.toString());
      SCORE_KEYS.forEach((k) => next.delete(k));
      const qs = next.toString();
      router.replace(qs ? `/hiring?${qs}` : "/hiring", { scroll: false });
    }
  }
  useCloseOnSuccess(pending, state.error, closeModal);

  const combinedTraits = [
    ...universalTraits.map((t) => ({ ...t, universal: true })),
    ...traitsByDept[department].map((t) => ({ ...t, universal: false })),
  ];
  const hasAnyGuide = combinedTraits.some((t) => t.question || t.green_flag || t.red_flag);

  return (
    <>
      <Btn icon={Plus} onClick={() => setOpen(true)}>
        Score a candidate
      </Btn>
      {open && (
        <Modal
          title={applicationId ? "Interview & score" : "Score a candidate"}
          sub={applicationId ? "The questions to ask are under each trait — run the interview, then score against your actual values." : "Against your actual values, not a generic rubric."}
          onClose={closeModal}
          wide
        >
          <form action={formAction}>
            <input type="hidden" name="recommendation" value={recommendation} />
            {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Candidate name">
                <StaffPicker
                  name="name"
                  staff={staff}
                  required
                  placeholder="Candidate name"
                  defaultNewName={prefillName}
                  onSelectExisting={(s) => setDepartment(s.department as Department)}
                />
              </Field>
              <Field label="Department applying for">
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

            {hasAnyGuide && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-muted">Score each trait</span>
                <button
                  type="button"
                  onClick={() => setShowGuide((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brick hover:text-brick-dark"
                >
                  <MessageSquareText size={14} />
                  {showGuide ? "Hide interview questions" : "Show interview questions"}
                </button>
              </div>
            )}

            <div key={department} className="flex flex-col gap-3 mb-4">
              {combinedTraits.map((t, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-2xl border ${t.universal ? "border-line" : "border-[#ffcc80]"} bg-panel`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill tone={t.universal ? "brick" : "gold"}>{t.universal ? "Universal" : department}</Pill>
                      <span className="text-sm font-semibold text-ink">{t.title}</span>
                    </div>
                    <StarRating name={`score_${i}`} />
                  </div>
                  {showGuide && (t.question || t.green_flag || t.red_flag) && (
                    <div className="mt-2.5 pt-2.5 border-t border-line/70 flex flex-col gap-1.5">
                      {t.question && (
                        <p className="text-[13px] text-charcoal-2">
                          <span className="font-semibold text-ink">Ask:</span> {t.question}
                        </p>
                      )}
                      {t.green_flag && (
                        <p className="text-[12.5px] text-muted flex items-start gap-1.5">
                          <Check size={13} className="mt-0.5 shrink-0 text-[#15803d]" />
                          <span><span className="font-semibold text-[#15803d]">Green flag:</span> {t.green_flag}</span>
                        </p>
                      )}
                      {t.red_flag && (
                        <p className="text-[12.5px] text-muted flex items-start gap-1.5">
                          <X size={13} className="mt-0.5 shrink-0 text-danger" />
                          <span><span className="font-semibold text-danger">Red flag:</span> {t.red_flag}</span>
                        </p>
                      )}
                    </div>
                  )}
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
                      recommendation === r ? "bg-charcoal text-white border-charcoal" : "bg-panel text-ink border-line"
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
              <Btn type="button" kind="ghost" onClick={closeModal}>
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
