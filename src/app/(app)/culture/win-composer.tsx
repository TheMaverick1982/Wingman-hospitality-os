"use client";

import { useActionState, useState } from "react";
import { PartyPopper } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { CULTURE_TAGS } from "@/lib/constants";
import { WIN_KINDS, type WinKind } from "@/lib/wins";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { StaffPicker, type StaffOption } from "@/components/staff-picker";
import { addCultureMoment, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

// Team-wide Wins composer. Anyone shares a win or recognizes a teammate; the
// post is attributed to them server-side. Replaces the old manager-only modal.
export function WinComposer({ staff, label = "Share a win" }: { staff: StaffOption[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WinKind>("win");
  const [state, formAction, pending] = useActionState(addCultureMoment, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn icon={PartyPopper} onClick={() => setOpen(true)}>
        {label}
      </Btn>
      {open && (
        <Modal
          title="Share a win"
          sub="Celebrate something that went well — or call out a teammate who nailed it."
          onClose={() => setOpen(false)}
        >
          <form action={formAction}>
            <input type="hidden" name="kind" value={kind} />
            <div className="flex gap-2 mb-4">
              {WIN_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border transition-colors ${
                    kind === k.id ? "border-brick text-white bg-brick" : "border-line text-charcoal-2 hover:border-brick"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {kind === "shoutout" && (
              <Field label="Who's this about?">
                <StaffPicker name="about" staff={staff} required placeholder="Pick a teammate" />
              </Field>
            )}

            <Field label="Tag">
              <select name="tag" defaultValue={CULTURE_TAGS[0]} className={inputClass}>
                {CULTURE_TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>

            <Field label={kind === "win" ? "What went well?" : "What did they do?"}>
              <textarea
                name="message"
                rows={3}
                required
                placeholder={kind === "win" ? "Be specific — what happened, and why it mattered." : "Be specific — what did they actually do?"}
                className={inputClass}
              />
            </Field>

            {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Posting…" : "Post to the feed"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
