"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Sparkles, Upload, Wand2, Clipboard, X } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateHiringCriteria, saveHiringCriteria, type BuildState, type GeneratedTrait } from "./hiring-builder-actions";

const initialState: BuildState = { error: null };

function TraitCard({ trait, onChange, onRemove }: { trait: GeneratedTrait; onChange: (t: GeneratedTrait) => void; onRemove: () => void }) {
  const cls = `${inputClass} text-[13px] py-1.5`;
  return (
    <div className="border border-line rounded-xl p-3 bg-paper/50">
      <div className="flex items-center gap-2 mb-2">
        <input value={trait.title} onChange={(e) => onChange({ ...trait, title: e.target.value })} placeholder="Trait" className={`${cls} font-semibold`} />
        <button type="button" onClick={onRemove} aria-label="Remove trait" className="shrink-0 text-muted-2 hover:text-danger">
          <X size={15} />
        </button>
      </div>
      <input value={trait.question} onChange={(e) => onChange({ ...trait, question: e.target.value })} placeholder="Interview question" className={`${cls} mb-1.5`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <input value={trait.green_flag} onChange={(e) => onChange({ ...trait, green_flag: e.target.value })} placeholder="Green flag" className={cls} />
        <input value={trait.red_flag} onChange={(e) => onChange({ ...trait, red_flag: e.target.value })} placeholder="Red flag" className={cls} />
      </div>
    </div>
  );
}

export function HiringTraitBuilder({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "upload" | "wizard">("paste");
  const [state, formAction, pending] = useActionState(generateHiringCriteria, initialState);

  const [traits, setTraits] = useState<GeneratedTrait[]>([]);
  const [ignore, setIgnore] = useState(true);
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const reviewing = state.traits != null && !ignore;

  // Syncing the async action result into local editable state is intended here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.traits) {
      setTraits(state.traits);
      setIgnore(false);
      setSaved(null);
      setSaveError(null);
    }
  }, [state.traits]);

  useEffect(() => {
    if (open) {
      setIgnore(true);
      setSaved(null);
      setSaveError(null);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (saved != null) {
      const t = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function doSave() {
    setSaveError(null);
    startSave(async () => {
      const res = await saveHiringCriteria(department, traits);
      if (res.error) setSaveError(res.error);
      else setSaved(res.built ?? traits.length);
    });
  }

  return (
    <>
      <Btn small kind="info" icon={Wand2} onClick={() => setOpen(true)}>
        Build hiring criteria
      </Btn>
      {open && (
        <Modal
          title={reviewing ? `Review ${department} hiring criteria` : `Build ${department} hiring criteria`}
          sub={
            reviewing
              ? "Edit or remove any trait below, then save. Nothing changes until you save."
              : "Upload your existing interview guide, or let Wingman build one from scratch -- screening for the person, not just the resume."
          }
          onClose={() => setOpen(false)}
          wide
        >
          {reviewing ? (
            <div>
              <div className="max-h-[52vh] overflow-y-auto flex flex-col gap-2.5 pr-1">
                {traits.map((t, i) => (
                  <TraitCard
                    key={i}
                    trait={t}
                    onChange={(nt) => setTraits(traits.map((x, j) => (j === i ? nt : x)))}
                    onRemove={() => setTraits(traits.filter((_, j) => j !== i))}
                  />
                ))}
                {traits.length === 0 && <p className="text-sm text-muted">All traits removed.</p>}
              </div>
              {saveError && <p className="text-sm text-danger mt-3">{saveError}</p>}
              {saved != null && <p className="text-sm text-[#15803d] mt-3">Saved {saved} hiring traits.</p>}
              <div className="flex justify-between gap-2 mt-4">
                <Btn type="button" kind="ghost" onClick={() => setIgnore(true)}>
                  Start over
                </Btn>
                <Btn type="button" onClick={doSave} loading={saving} disabled={saved != null || traits.length === 0} icon={Sparkles}>
                  {saving ? "Saving..." : saved != null ? "Saved" : "Save criteria"}
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-5 flex-wrap">
                <button type="button" onClick={() => setMode("paste")} className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${mode === "paste" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                    <Clipboard size={15} /> Paste text
                  </div>
                  <p className="text-xs text-muted">Paste your interview guide or notes — the most reliable way in.</p>
                </button>
                <button type="button" onClick={() => setMode("upload")} className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${mode === "upload" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
                    <Upload size={15} /> Upload a file
                  </div>
                  <p className="text-xs text-muted">A PDF or photo of what you already use.</p>
                </button>
                <button type="button" onClick={() => setMode("wizard")} className={`flex-1 min-w-[160px] rounded-xl border px-4 py-3 text-left transition-colors ${mode === "wizard" ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"}`}>
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
                    <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Paste your existing interview guide / criteria</label>
                    <textarea name="pastedText" rows={8} required placeholder="Paste your interview questions, scorecard, or notes here…" className={`${inputClass} resize-y`} />
                    <p className="text-xs text-muted mt-1.5">Wingman reads it, keeps what&apos;s already there, and adds any characteristics-based questions that are missing.</p>
                  </div>
                ) : mode === "upload" ? (
                  <div className="mb-2">
                    <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Existing interview guide / scorecard</label>
                    <input type="file" name="file" accept="image/*,application/pdf" required className="text-sm text-charcoal-2 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-paper file:text-ink file:text-sm file:font-semibold w-full" />
                    <p className="text-xs text-muted mt-1.5">Best for a clear, text-based PDF or a sharp photo. If it errors, try the Paste option instead.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 mb-2">
                    <div>
                      <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">What roles or shifts for this position are hardest to fill or keep staffed?</label>
                      <textarea name="hardToFill" rows={2} className={`${inputClass} resize-none`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Think of a hire who looked good on paper but wasn&apos;t a fit -- what was missing?</label>
                      <textarea name="pastMiss" rows={2} className={`${inputClass} resize-none`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">What characteristics actually predict success in this role at your restaurant?</label>
                      <textarea name="successTraits" rows={2} className={`${inputClass} resize-none`} />
                    </div>
                  </div>
                )}

                {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}

                <div className="flex justify-end gap-2 mt-4">
                  <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                    Close
                  </Btn>
                  <Btn type="submit" loading={pending} icon={Sparkles}>
                    {pending ? "Building..." : "Build & review"}
                  </Btn>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
