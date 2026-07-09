"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { completeMyPreshift, type PreshiftState } from "./shift-checklist-actions";

const initialState: PreshiftState = { error: null };

export function MyPreshiftCard({
  items,
  alreadyDone,
  completedChecked,
  completedAt,
}: {
  items: string[];
  alreadyDone: boolean;
  completedChecked: boolean[];
  completedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(completeMyPreshift, initialState);
  const [editing, setEditing] = useState(false);

  const done = (alreadyDone || state.done) && !editing;

  if (items.length === 0) return null;

  if (done) {
    return (
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-[#15803d]" />
          <div>
            <div className="text-[15px] font-semibold text-ink">Your pre-shift checklist is done for today</div>
            <div className="text-[13px] text-muted">
              {completedAt ? `Completed at ${new Date(completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Completed"}
              {" · "}
              <button type="button" onClick={() => setEditing(true)} className="font-semibold text-brick hover:opacity-70">
                Update
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck size={16} className="text-brick" />
        <h3 className="text-[15px] font-semibold text-ink">Your pre-shift checklist</h3>
      </div>
      <p className="text-[13px] text-muted mb-4">Check off what you&apos;ve done, then submit so your manager can see it.</p>
      <form action={formAction}>
        <div className="flex flex-col gap-2.5 mb-4">
          {items.map((item, i) => (
            <label key={i} className="flex items-start gap-2.5 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                name="checked"
                value={i}
                defaultChecked={completedChecked[i] ?? false}
                className="mt-0.5 accent-brick w-4 h-4 shrink-0"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        <div className="flex justify-end gap-2">
          {editing && (
            <Btn type="button" kind="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Btn>
          )}
          <Btn type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit checklist"}
          </Btn>
        </div>
      </form>
    </div>
  );
}
