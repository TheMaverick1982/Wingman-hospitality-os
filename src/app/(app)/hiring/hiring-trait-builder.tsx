"use client";

import { useActionState, useState } from "react";
import { Sparkles, Upload, Wand2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateHiringCriteria, type BuildState } from "./hiring-builder-actions";

const initialState: BuildState = { error: null };

export function HiringTraitBuilder({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "wizard">("upload");
  const [state, formAction, pending] = useActionState(generateHiringCriteria, initialState);

  return (
    <>
      <Btn small kind="ghost" icon={Wand2} onClick={() => setOpen(true)}>
        Build hiring criteria
      </Btn>
      {open && (
        <Modal
          title={`Build ${department} hiring criteria`}
          sub="Upload your existing interview guide, or let Wingman build one from scratch -- screening for the person, not just the resume."
          onClose={() => setOpen(false)}
          wide
        >
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === "upload" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                <Upload size={15} /> I have existing criteria
              </div>
              <p className="text-xs text-muted">Upload an interview guide, scorecard, or PDF you already use.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("wizard")}
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === "wizard" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                <Sparkles size={15} /> Build from scratch
              </div>
              <p className="text-xs text-muted">Answer a few questions and Wingman writes the criteria.</p>
            </button>
          </div>

          <form action={formAction}>
            <input type="hidden" name="department" value={department} />
            <input type="hidden" name="mode" value={mode} />

            {mode === "upload" ? (
              <div className="mb-2">
                <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Existing interview guide / scorecard</label>
                <input
                  type="file"
                  name="file"
                  accept="image/*,application/pdf"
                  required
                  className="text-sm text-charcoal-2 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-paper file:text-ink file:text-sm file:font-semibold w-full"
                />
                <p className="text-xs text-muted mt-1.5">
                  Wingman reads it, keeps what&apos;s already there, and adds any characteristics-based questions that are missing.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-2">
                <div>
                  <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                    What roles or shifts for this position are hardest to fill or keep staffed?
                  </label>
                  <textarea name="hardToFill" rows={2} className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                    Think of a hire who looked good on paper but wasn&apos;t a fit -- what was missing?
                  </label>
                  <textarea name="pastMiss" rows={2} className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                    What characteristics actually predict success in this role at your restaurant?
                  </label>
                  <textarea name="successTraits" rows={2} className={`${inputClass} resize-none`} />
                </div>
              </div>
            )}

            {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}
            {state.built != null && !state.error && (
              <p className="text-sm text-[#15803d] mt-2">Built {state.built} hiring traits for {department}.</p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Close
              </Btn>
              <Btn type="submit" disabled={pending} icon={Sparkles}>
                {pending ? "Building..." : "Build criteria"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
