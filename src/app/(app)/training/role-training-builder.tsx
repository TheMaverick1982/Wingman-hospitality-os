"use client";

import { useActionState, useState } from "react";
import { Sparkles, Upload, Wand2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateRoleTraining, type BuildState } from "./role-training-actions";

const initialState: BuildState = { error: null };

export function RoleTrainingBuilder({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "wizard">("upload");
  const [state, formAction, pending] = useActionState(generateRoleTraining, initialState);

  return (
    <>
      <Btn small kind="ghost" icon={Wand2} onClick={() => setOpen(true)}>
        Build training program
      </Btn>
      {open && (
        <Modal
          title={`Build ${department} training`}
          sub="Upload what you already have, or let Wingman build it from scratch -- either way it adds a complete, best-practice program."
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
                <Upload size={15} /> I have existing training
              </div>
              <p className="text-xs text-muted">Upload a handbook page, PDF, or photo of what you already use.</p>
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
              <p className="text-xs text-muted">Answer a few questions and Wingman writes the whole program.</p>
            </button>
          </div>

          <form action={formAction}>
            <input type="hidden" name="department" value={department} />
            <input type="hidden" name="mode" value={mode} />

            {mode === "upload" ? (
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
                  Wingman reads it, keeps what&apos;s already there, and adds anything missing from hospitality best practices.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-2">
                <div>
                  <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                    What does great service look like for this role at your restaurant?
                  </label>
                  <textarea name="greatService" rows={2} className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                    What&apos;s the #1 recurring gap or mistake you see from this role?
                  </label>
                  <textarea name="painPoint" rows={2} className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">
                    Any signature touch you want reflected? (optional)
                  </label>
                  <textarea name="signature" rows={2} className={`${inputClass} resize-none`} />
                </div>
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
