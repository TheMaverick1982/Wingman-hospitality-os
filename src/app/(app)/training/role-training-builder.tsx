"use client";

import { useActionState, useEffect, useState } from "react";
import { Sparkles, Upload, Wand2, Clipboard } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateRoleTraining, type BuildState } from "./role-training-actions";

const initialState: BuildState = { error: null };

const WIZARD_QUESTIONS: Record<string, string[]> = {
  Host: [
    "What should the first 30 seconds feel like for a guest walking in -- greeting, eye contact, tone?",
    "How do you want a longer-than-expected wait handled so it doesn't feel like a wait?",
    "How should hosts recognize and seat returning or VIP guests differently?",
  ],
  Server: [
    "What's the ideal check-in cadence during a table's visit -- how often, what tone?",
    "How do you want servers to recommend or upsell without it feeling pushy?",
    "What's the standard for handling a mistake or complaint right at the table?",
  ],
  Bartender: [
    "What should a guest sitting alone at the bar experience, versus a group?",
    "How do you want speed balanced against hospitality during a rush?",
    "What's your standard for recommending drinks or upselling at the bar?",
  ],
  Chef: [
    "What are your non-negotiable food safety and ticket-time standards?",
    "How should the kitchen communicate 86'd items or delays to the front of house?",
    "How do you want the kitchen to react when a dish comes back or gets a complaint?",
  ],
  Manager: [
    "What does actually walking the floor look like for you -- how often, what are you checking?",
    "How do you want an escalated guest complaint handled, start to finish?",
    "What's the one leadership behavior you most want modeled for the team?",
  ],
};
const DEFAULT_QUESTIONS = [
  "What does great service look like for this role at your restaurant?",
  "What's the #1 recurring gap or mistake you see from this role?",
  "Any signature touch you want reflected?",
];

export function RoleTrainingBuilder({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "upload" | "wizard">("paste");
  const [state, formAction, pending] = useActionState(generateRoleTraining, initialState);
  const questions = WIZARD_QUESTIONS[department] ?? DEFAULT_QUESTIONS;

  // On a successful build, show the confirmation briefly, then close so the new
  // program is visible on the page (which revalidated with the fresh items).
  useEffect(() => {
    if (state.built && !state.error) {
      const t = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(t);
    }
  }, [state.built, state.error]);

  return (
    <>
      <Btn small kind="info" icon={Wand2} onClick={() => setOpen(true)}>
        Build training program
      </Btn>
      {open && (
        <Modal
          title={`Build ${department} training`}
          sub="Upload what you already have, or let Wingman build it from scratch -- either way it adds a complete, best-practice program."
          onClose={() => setOpen(false)}
          wide
        >
          <div className="flex gap-2 mb-5 flex-wrap">
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === "paste" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                <Clipboard size={15} /> Paste text
              </div>
              <p className="text-xs text-muted">Paste your handbook or notes — the most reliable way in.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === "upload" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                <Upload size={15} /> Upload a file
              </div>
              <p className="text-xs text-muted">A PDF or photo of what you already use.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("wizard")}
              className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === "wizard" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                <Sparkles size={15} /> Build from scratch
              </div>
              <p className="text-xs text-muted">Answer a few questions and Wingman writes it.</p>
            </button>
          </div>

          <form action={formAction}>
            <input type="hidden" name="department" value={department} />
            <input type="hidden" name="mode" value={mode} />

            {mode === "paste" ? (
              <div className="mb-2">
                <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Paste your existing training</label>
                <textarea
                  name="pastedText"
                  rows={8}
                  required
                  placeholder="Paste the text from your handbook, SOPs, or notes here…"
                  className={`${inputClass} resize-y`}
                />
                <p className="text-xs text-muted mt-1.5">
                  Wingman reads it, keeps what&apos;s already there, and adds anything missing from hospitality best practices.
                </p>
              </div>
            ) : mode === "upload" ? (
              <div className="mb-2">
                <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Existing training document</label>
                <input
                  type="file"
                  name="file"
                  accept="image/*,application/pdf"
                  required
                  className="text-sm text-charcoal-2 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-paper file:text-ink file:text-sm file:font-semibold w-full"
                />
                <p className="text-xs text-muted mt-1.5">
                  Best for a clear, text-based PDF or a sharp photo. If it errors, try the Paste option instead.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-2">
                {questions.map((q, i) => (
                  <div key={i}>
                    <input type="hidden" name={`question_${i}`} value={q} />
                    <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">{q}</label>
                    <textarea name={`answer_${i}`} rows={2} className={`${inputClass} resize-none`} />
                  </div>
                ))}
              </div>
            )}

            {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}
            {state.built && !state.error && (
              <p className="text-sm text-[#15803d] mt-2">
                Built {state.built.hospitality} hospitality items and {state.built.role} role items.
              </p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Close
              </Btn>
              <Btn type="submit" disabled={pending} icon={Sparkles}>
                {pending ? "Building..." : "Build program"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
