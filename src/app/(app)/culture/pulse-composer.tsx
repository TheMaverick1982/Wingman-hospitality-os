"use client";

import { useActionState, useState } from "react";
import { HeartPulse, Check } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { submitCulturePulse, type PulseState } from "./pulse-actions";

const initial: PulseState = { error: null };

const QUESTIONS: { name: string; label: string }[] = [
  { name: "recognized", label: "I feel recognized for good work." },
  { name: "values_clear", label: "I'm clear on what we stand for (our values)." },
  { name: "proud", label: "I'm proud to work here." },
];

const SCALE = [
  { v: 1, label: "Strongly disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly agree" },
];

// The team's 30-second, anonymous monthly check-in. Answers are never tied to a
// person — this composer just posts the scores + an optional comment.
export function PulseComposer({ alreadyDone }: { alreadyDone: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitCulturePulse, initial);
  const [scores, setScores] = useState<Record<string, number>>({});
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  if (alreadyDone) {
    return (
      <div className="rounded-2xl border border-olive/30 bg-olive-tint/50 p-5 flex items-center gap-3">
        <Check size={18} className="text-[#15803D] shrink-0" />
        <div className="text-[14px] text-[#166534]">Thanks for checking in this month — your answers are anonymous.</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-brick/20 bg-brick-tint/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-brick text-white flex items-center justify-center shrink-0">
          <HeartPulse size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink">This month&rsquo;s culture check</div>
          <p className="text-[13.5px] text-charcoal-2 mt-0.5">30 seconds, completely anonymous. Tell us how it really feels to work here.</p>
        </div>
        <div className="shrink-0">
          <Btn icon={HeartPulse} onClick={() => setOpen(true)}>Check in</Btn>
        </div>
      </div>

      {open && (
        <Modal
          title="This month's culture check"
          sub="Anonymous — your name is never attached. Answer honestly; it helps us get better."
          onClose={() => setOpen(false)}
        >
          <form action={formAction}>
            {QUESTIONS.map((q) => (
              <div key={q.name} className="mb-5">
                <div className="text-[14px] font-semibold text-ink mb-2">{q.label}</div>
                <input type="hidden" name={q.name} value={scores[q.name] ?? ""} />
                <div className="grid grid-cols-5 gap-1.5">
                  {SCALE.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setScores((cur) => ({ ...cur, [q.name]: s.v }))}
                      title={s.label}
                      className={`rounded-lg py-2 text-sm font-semibold border transition-colors ${
                        scores[q.name] === s.v ? "bg-brick text-white border-brick" : "bg-paper text-charcoal-2 border-line hover:border-brick"
                      }`}
                    >
                      {s.v}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[11px] text-muted-2 mt-1">
                  <span>Strongly disagree</span>
                  <span>Strongly agree</span>
                </div>
              </div>
            ))}

            <div className="mb-2">
              <div className="text-[14px] font-semibold text-ink mb-2">Anything you&rsquo;d change, or a win to share? (optional)</div>
              <textarea name="comment" rows={3} placeholder="Totally anonymous." className={inputClass} />
            </div>

            {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn type="submit" disabled={pending}>{pending ? "Sending…" : "Send anonymously"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
