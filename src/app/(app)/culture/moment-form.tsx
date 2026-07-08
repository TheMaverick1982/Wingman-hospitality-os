"use client";

import { useActionState, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { CULTURE_TAGS } from "@/lib/constants";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { StaffPicker, type StaffOption } from "@/components/staff-picker";
import { addCultureMoment, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function MomentModalButton({ staff }: { staff: StaffOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addCultureMoment, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  return (
    <>
      <Btn icon={MessageSquarePlus} onClick={() => setOpen(true)}>
        Recognize someone
      </Btn>
      {open && (
        <Modal
          title="Recognize someone"
          sub="Call out a specific moment. Details matter more than praise."
          onClose={() => setOpen(false)}
        >
          <form action={formAction}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Your name">
                <StaffPicker name="author" staff={staff} required placeholder="Your name" />
              </Field>
              <Field label="Who's this about?">
                <StaffPicker name="about" staff={staff} required placeholder="Who's this about?" />
              </Field>
            </div>
            <Field label="Tag">
              <select name="tag" defaultValue={CULTURE_TAGS[0]} className={inputClass}>
                {CULTURE_TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="What happened?">
              <textarea
                name="message"
                rows={3}
                required
                placeholder="Be specific — what did they actually do?"
                className={inputClass}
              />
            </Field>
            {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Posting..." : "Post to culture wall"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
