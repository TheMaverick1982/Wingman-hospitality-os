"use client";

import { useActionState, useEffect, useState } from "react";
import { CRM_STAGES } from "@/lib/crm";
import { createContact, type CrmActionState } from "./actions";

const initial: CrmActionState = { error: null, ok: false };

export function AddContactModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createContact, initial);
  // createContact redirects on success, so we only ever see an error state here.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="text-[17px] font-semibold text-ink">Add contact</div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-2 hover:text-ink text-xl leading-none">×</button>
        </div>
        <form action={action} className="px-6 pb-6 flex flex-col gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Name</label>
          <input name="name" placeholder="Full name" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink placeholder:text-muted-2" />

          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Email <span className="text-danger">*</span></label>
          <input name="email" type="email" required placeholder="name@email.com" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink placeholder:text-muted-2" />

          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Phone</label>
          <input name="phone" placeholder="(555) 555-5555" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink placeholder:text-muted-2" />

          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Stage</label>
          <select name="stage" defaultValue="new" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink">
            {CRM_STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <div className="flex items-center justify-between mt-1">
            {state.error ? <span className="text-[12.5px] text-danger">{state.error}</span> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="text-[13px] font-semibold text-charcoal-2 px-4 py-2 rounded-lg hover:bg-paper transition-colors">Cancel</button>
              <button type="submit" disabled={pending} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark disabled:opacity-40 transition-colors">
                {pending ? "Creating…" : "Create contact"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
