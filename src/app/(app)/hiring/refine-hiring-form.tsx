"use client";

import { useActionState, useState, useTransition } from "react";
import { MessagesSquare, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { refineHiring, applyHiringRefinement, type RefineState, type HiringProposal, type HiringChange } from "./hiring-builder-actions";

const initialState: RefineState = { error: null };

export function RefineHiringForm({ department }: { department: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(refineHiring, initialState);
  const [applying, startApply] = useTransition();
  const [applyError, setApplyError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const proposal: HiringProposal | undefined = dismissed ? undefined : state.proposal;

  function close() {
    setOpen(false);
    setApplyError(null);
    setDismissed(false);
  }

  function accept() {
    if (!proposal) return;
    setApplyError(null);
    startApply(async () => {
      const res = await applyHiringRefinement(department, proposal);
      if (res.error) setApplyError(res.error);
      else close();
    });
  }

  const changeCount = proposal ? proposal.add.length + proposal.edit.length + proposal.remove.length : 0;

  return (
    <>
      <Btn small kind="ghost" icon={MessagesSquare} onClick={() => setOpen(true)}>
        Refine with AI
      </Btn>
      {open && (
        <Modal
          title={`Refine ${department} hiring criteria`}
          sub="Ask Wingman to add traits, suggest ideas, reword, or remove — you'll review every change before it's applied."
          onClose={close}
          wide
        >
          {!proposal ? (
            <form action={formAction} onSubmit={() => setDismissed(false)}>
              <input type="hidden" name="department" value={department} />
              <label className="text-sm font-medium text-charcoal-2 mb-1.5 block">What would you like to change?</label>
              <textarea
                name="feedback"
                rows={4}
                required
                maxLength={2000}
                placeholder="e.g. Add a trait that screens for how they handle an angry guest. Or: Suggest 3 more traits for a bartender. Or: Make the teamwork question tougher."
                className={`${inputClass} resize-none`}
              />
              {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}
              <div className="flex justify-end gap-2 mt-4">
                <Btn type="button" kind="ghost" onClick={close}>
                  Cancel
                </Btn>
                <Btn type="submit" disabled={pending} icon={Sparkles}>
                  {pending ? "Thinking..." : "Get suggestions"}
                </Btn>
              </div>
            </form>
          ) : (
            <div>
              <p className="text-sm text-muted mb-4">{proposal.summary}</p>

              <div className="flex flex-col gap-4 max-h-[440px] overflow-y-auto pr-1">
                {proposal.add.length > 0 && (
                  <Section title="New traits" tone="add" icon={<Plus size={14} />}>
                    {proposal.add.map((c, i) => (
                      <TraitCard key={`a${i}`} c={c} />
                    ))}
                  </Section>
                )}
                {proposal.edit.length > 0 && (
                  <Section title="Reworked traits" tone="edit" icon={<Pencil size={14} />}>
                    {proposal.edit.map((c, i) => (
                      <TraitCard key={`e${i}`} c={c} showBefore />
                    ))}
                  </Section>
                )}
                {proposal.remove.length > 0 && (
                  <Section title="Removed traits" tone="remove" icon={<Trash2 size={14} />}>
                    {proposal.remove.map((c, i) => (
                      <div key={`r${i}`} className="border border-line rounded-xl p-3">
                        <div className="text-sm text-muted-2 line-through font-medium">{c.title}</div>
                        {c.reason && <p className="text-xs text-muted mt-1">{c.reason}</p>}
                      </div>
                    ))}
                  </Section>
                )}
              </div>

              {applyError && <p className="text-sm text-danger mt-3">{applyError}</p>}

              <div className="flex justify-between gap-2 mt-5">
                <Btn type="button" kind="ghost" onClick={() => setDismissed(true)}>
                  Start over
                </Btn>
                <div className="flex gap-2">
                  <Btn type="button" kind="ghost" onClick={close}>
                    Discard
                  </Btn>
                  <Btn type="button" disabled={applying} onClick={accept} icon={Sparkles}>
                    {applying ? "Applying..." : `Apply ${changeCount} change${changeCount === 1 ? "" : "s"}`}
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function Section({
  title,
  tone,
  icon,
  children,
}: {
  title: string;
  tone: "add" | "edit" | "remove";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const color = tone === "add" ? "text-[#15803d]" : tone === "remove" ? "text-brick" : "text-[#B45309]";
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>
        {icon} {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function TraitCard({ c, showBefore }: { c: HiringChange; showBefore?: boolean }) {
  return (
    <div className="border border-line rounded-xl p-3">
      {showBefore && c.before && (
        <div className="text-xs text-muted-2 line-through mb-1.5">{c.before.title}</div>
      )}
      <div className="text-sm font-semibold text-ink">{c.title}</div>
      <div className="text-sm text-charcoal-2 mt-1">{c.question}</div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="text-xs">
          <span className="font-semibold text-[#15803d]">Green flag:</span>{" "}
          <span className="text-muted">{c.green_flag}</span>
        </div>
        <div className="text-xs">
          <span className="font-semibold text-brick">Red flag:</span>{" "}
          <span className="text-muted">{c.red_flag}</span>
        </div>
      </div>
      {c.reason && <p className="text-xs text-muted mt-2 pt-2 border-t border-line">{c.reason}</p>}
    </div>
  );
}
