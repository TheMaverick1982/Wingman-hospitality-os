"use client";

import { useActionState, useRef, useState } from "react";
import { UserPlus, Mail, X } from "lucide-react";
import { inviteFranchisee, type InviteFranchiseeState } from "./actions";

const initial: InviteFranchiseeState = { error: null };

// Franchisor self-service: invite a new franchisee into the group. They get an
// email to create their account, and it auto-joins this group.
export function InviteFranchisee() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteFranchisee, initial);
  const formRef = useRef<HTMLFormElement>(null);

  if (state.ok && formRef.current) formRef.current.reset();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 bg-white border border-line rounded-2xl px-6 py-4 hover:border-brick transition-colors shadow-sm text-left w-full"
      >
        <UserPlus size={18} className="text-brick shrink-0" />
        <span className="text-sm text-ink flex-1">
          <span className="font-semibold">Add a franchisee</span> — send them an email to create their account. It joins your group automatically.
        </span>
      </button>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-brick" />
          <h2 className="text-[15px] font-semibold text-ink">Invite a franchisee</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-2 hover:text-ink" aria-label="Close"><X size={16} /></button>
      </div>
      <form ref={formRef} action={action} className="flex flex-col gap-2.5 max-w-md">
        <input name="name" required placeholder="Owner's name" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
        <input name="email" type="email" required placeholder="Owner's email (for their login)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
        <input name="business" placeholder="Business name (optional)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
        <input name="location" placeholder="First location name (optional)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50">
          <Mail size={15} /> {pending ? "Sending invite…" : "Send invite"}
        </button>
        <p className="text-[12px] text-muted-2 leading-snug">
          They get a set-password email and a full account (their own team, guests, and billing), pre-loaded with the starter playbook — and automatically joined to your group so your brand standards and oversight apply.
        </p>
        {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
        {state.ok && !state.error && <p className="text-[13px] text-[#15803d] font-medium">Invite sent{state.name ? ` — ${state.name} added to your group.` : "."}</p>}
      </form>
    </div>
  );
}
