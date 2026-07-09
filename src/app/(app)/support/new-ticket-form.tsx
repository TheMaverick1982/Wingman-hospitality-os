"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useState } from "react";
import { createTicket, type TicketState } from "./actions";

const initialState: TicketState = { error: null };

export function NewTicketButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTicket, initialState);

  return (
    <>
      <Btn icon={Plus} onClick={() => setOpen(true)}>
        New ticket
      </Btn>
      {open && (
        <Modal title="New support ticket" sub="Tell us what's going on and we'll get back to you by email and here." onClose={() => setOpen(false)}>
          {/* createTicket redirects to the new ticket on success, so no close-on-success needed. */}
          <form action={formAction}>
            <Field label="Subject">
              <input name="subject" required placeholder="e.g. Can't invite a team member" className={inputClass} />
            </Field>
            <Field label="How can we help?">
              <textarea
                name="message"
                rows={6}
                required
                placeholder="Describe what you're trying to do and what's happening."
                className={`${inputClass} resize-y`}
              />
            </Field>
            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={pending}>
                {pending ? "Sending…" : "Submit ticket"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
