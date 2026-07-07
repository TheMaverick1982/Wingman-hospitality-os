"use client";

import { useActionState, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Location } from "@/lib/data/locations";
import { logCoaching, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

const STEPS = [
  {
    n: 1,
    title: "State — meet them where they are",
    body: "Check their head first. Rushed, defensive, slammed? Lower the temperature before any feedback lands.",
  },
  {
    n: 2,
    title: "Story — reframe the belief",
    body: "Find the story driving the behavior (\"we were too busy\") and replace it with the standard the guest still deserves.",
  },
  {
    n: 3,
    title: "Strategy — one concrete move",
    body: "Give a single, specific action they can use on the very next table — not a lecture. Make it easy to win.",
  },
];

export function CoachingModalButton({
  flagText,
  locations,
  isGm,
  lockedLocationName,
  defaultLocationId,
}: {
  flagText: string;
  locations: Location[];
  isGm: boolean;
  lockedLocationName: string | null;
  defaultLocationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(logCoaching, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn small kind="ghost" icon={MessageCircle} onClick={() => setOpen(true)}>
        Coach
      </Btn>
      {open && (
        <Modal title="Coaching playbook" sub={flagText} onClose={() => setOpen(false)}>
          <form action={formAction}>
            <input type="hidden" name="flagText" value={flagText} />
            <div className="flex flex-col gap-4 mb-5">
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brick-tint text-brick text-xs font-mono font-semibold flex items-center justify-center shrink-0">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink mb-0.5">{s.title}</p>
                    <p className="text-xs text-muted leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

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
            <Field label="Strategy — what specific move did you give them?">
              <textarea name="strategyNote" rows={2} className={inputClass} />
            </Field>
            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Logging..." : "Log coaching"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
