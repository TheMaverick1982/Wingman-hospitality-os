"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Sparkles, Upload, Wand2, Clipboard, X } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateRoleTraining, saveRoleTraining, type BuildState } from "./role-training-actions";

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

function ItemList({ title, items, setItems }: { title: string; items: string[]; setItems: (v: string[]) => void }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-ink mb-2">
        {title} <span className="text-muted-2">({items.length})</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={it}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${inputClass} text-[13px] py-1.5`}
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              aria-label="Remove item"
              className="shrink-0 text-muted-2 hover:text-danger"
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">None — removed.</p>}
      </div>
    </div>
  );
}

export function RoleTrainingBuilder({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "upload" | "wizard">("paste");
  const [state, formAction, pending] = useActionState(generateRoleTraining, initialState);
  const questions = WIZARD_QUESTIONS[department] ?? DEFAULT_QUESTIONS;

  // Review state.
  const [hospitality, setHospitality] = useState<string[]>([]);
  const [role, setRole] = useState<string[]>([]);
  const [ignoreProgram, setIgnoreProgram] = useState(true);
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ hospitality: number; role: number } | null>(null);

  const reviewing = state.program != null && !ignoreProgram;

  // Fresh preview arrives → load it into the editable review lists. Syncing an
  // async action result into local editable state is the intended use here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.program) {
      setHospitality(state.program.hospitality_items ?? []);
      setRole(state.program.role_items ?? []);
      setIgnoreProgram(false);
      setSaved(null);
      setSaveError(null);
    }
  }, [state.program]);

  // Reset to the input step each time the modal opens.
  useEffect(() => {
    if (open) {
      setIgnoreProgram(true);
      setSaved(null);
      setSaveError(null);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Confirm the save briefly, then close so the program is visible on the page.
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function doSave() {
    setSaveError(null);
    startSave(async () => {
      const res = await saveRoleTraining(department, hospitality, role, state.program?.track_label);
      if (res.error) setSaveError(res.error);
      else setSaved(res.built ?? { hospitality: hospitality.length, role: role.length });
    });
  }

  return (
    <>
      <Btn small kind="info" icon={Wand2} onClick={() => setOpen(true)}>
        Build training program
      </Btn>
      {open && (
        <Modal
          title={reviewing ? `Review ${department} training` : `Build ${department} training`}
          sub={
            reviewing
              ? "Edit or remove anything below, then save. Nothing changes until you save."
              : "Upload what you already have, or let Wingman build it from scratch -- either way it adds a complete, best-practice program."
          }
          onClose={() => setOpen(false)}
          wide
        >
          {reviewing ? (
            <div>
              <div className="max-h-[52vh] overflow-y-auto flex flex-col gap-5 pr-1">
                <ItemList title="Hospitality behaviors" items={hospitality} setItems={setHospitality} />
                <ItemList title="Role-specific skills" items={role} setItems={setRole} />
              </div>
              {saveError && <p className="text-sm text-danger mt-3">{saveError}</p>}
              {saved && <p className="text-sm text-[#15803d] mt-3">Saved {saved.hospitality} hospitality and {saved.role} role items.</p>}
              <div className="flex justify-between gap-2 mt-4">
                <Btn type="button" kind="ghost" onClick={() => setIgnoreProgram(true)}>
                  Start over
                </Btn>
                <Btn type="button" onClick={doSave} loading={saving} disabled={saved != null || (hospitality.length === 0 && role.length === 0)} icon={Sparkles}>
                  {saving ? "Saving..." : saved ? "Saved" : "Save program"}
                </Btn>
              </div>
            </div>
          ) : (
            <>
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
                    <textarea name="pastedText" rows={8} required placeholder="Paste the text from your handbook, SOPs, or notes here…" className={`${inputClass} resize-y`} />
                    <p className="text-xs text-muted mt-1.5">Wingman reads it, keeps what&apos;s already there, and adds anything missing from hospitality best practices.</p>
                  </div>
                ) : mode === "upload" ? (
                  <div className="mb-2">
                    <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">Existing training document</label>
                    <input type="file" name="file" accept="image/*,application/pdf" required className="text-sm text-charcoal-2 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-paper file:text-ink file:text-sm file:font-semibold w-full" />
                    <p className="text-xs text-muted mt-1.5">Best for a clear, text-based PDF or a sharp photo. If it errors, try the Paste option instead.</p>
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
