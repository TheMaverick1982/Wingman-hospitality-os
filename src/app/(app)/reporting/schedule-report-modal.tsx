"use client";

import { useActionState, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { scheduleReport, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

const SECTIONS = [
  { key: "culture", label: "Culture" },
  { key: "bounceback", label: "Guest Bounce Back" },
  { key: "recovery", label: "Service Recovery" },
  { key: "training", label: "Training" },
  { key: "accountability", label: "Accountability" },
  { key: "hiring", label: "Hiring" },
  { key: "growth", label: "Revenue Growth Planner" },
];

export function ScheduleReportModalButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(scheduleReport, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn icon={CalendarClock} onClick={() => setOpen(true)}>
        Schedule a report
      </Btn>
      {open && (
        <Modal title="Schedule a report" sub="Pick what to include and how often. It arrives by email." onClose={() => setOpen(false)}>
          <form action={formAction}>
            <Field label="Frequency">
              <div className="grid grid-cols-3 gap-2">
                {["weekly", "biweekly", "monthly"].map((f) => (
                  <label key={f} className="flex items-center justify-center gap-2 border border-line-strong rounded-lg py-2.5 cursor-pointer has-[:checked]:bg-brick has-[:checked]:text-white has-[:checked]:border-brick text-sm font-semibold capitalize">
                    <input type="radio" name="frequency" value={f} defaultChecked={f === "weekly"} className="sr-only" />
                    {f}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Sections to include">
              <div className="grid grid-cols-2 gap-2.5">
                {SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name={`section_${s.key}`} defaultChecked className="accent-brick" />
                    {s.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Recipients (comma-separated emails — Managers and Super Admins only)">
              <input name="recipients" placeholder="you@example.com, manager@example.com" className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Saving..." : "Schedule report"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
