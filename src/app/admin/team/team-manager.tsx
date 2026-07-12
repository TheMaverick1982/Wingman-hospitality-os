"use client";

import { useActionState, useState, useTransition } from "react";
import { UserPlus, Sparkles } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import {
  addPlatformStaff,
  updatePlatformStaffAccess,
  removePlatformStaff,
  resendPlatformInvite,
  sendPlatformPasswordReset,
  requestW9,
  uploadW9,
  type TeamState,
} from "./actions";

export type W9Status = "none" | "requested" | "received";
export type StaffRow = { id: string; fullName: string; email: string; access: string[]; pending: boolean; w9Status: W9Status; hasW9: boolean };
type Section = { key: string; label: string; description: string };

const initialState: TeamState = { error: null };

export function TeamManager({ staff, sections, currentUserId }: { staff: StaffRow[]; sections: Section[]; currentUserId: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Btn icon={UserPlus} onClick={() => setAdding(true)}>
          Add teammate
        </Btn>
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        {staff.length === 0 ? (
          <p className="text-sm text-muted p-6">No platform staff yet.</p>
        ) : (
          staff.map((s) => (
            <StaffCard key={s.id} staff={s} sections={sections} isSelf={s.id === currentUserId} />
          ))
        )}
      </div>

      {adding && <AddModal sections={sections} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddModal({ sections, onClose }: { sections: Section[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addPlatformStaff, initialState);
  useCloseOnSuccess(pending, state.error, onClose);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function preset(keys: string[]) {
    setChecked(new Set(keys));
  }

  return (
    <Modal title="Add a teammate" sub="If they don't have a Wingman account yet, we'll invite them and grant access in one step." onClose={onClose} wide>
      <form action={formAction}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Name">
            <input name="fullName" placeholder="Alex Rivera" className={inputClass} />
          </Field>
          <Field label="Their email">
            <input name="email" type="email" required placeholder="alex@themaverickagency.com" className={inputClass} />
          </Field>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-ink">Access</span>
          <button type="button" onClick={() => preset(["support"])} className="text-xs font-semibold text-brick hover:opacity-70 inline-flex items-center gap-1">
            <Sparkles size={12} /> Support agent
          </button>
          <span className="text-muted-2 text-xs">·</span>
          <button type="button" onClick={() => preset(["crm", "sales_dashboard", "sales_training"])} className="text-xs font-semibold text-brick hover:opacity-70 inline-flex items-center gap-1">
            <Sparkles size={12} /> Sales agent
          </button>
          <span className="text-muted-2 text-xs">·</span>
          <button type="button" onClick={() => preset(sections.map((s) => s.key))} className="text-xs font-semibold text-brick hover:opacity-70">
            Full access
          </button>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          {sections.map((sec) => (
            <label key={sec.key} className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="sections" value={sec.key} checked={checked.has(sec.key)} onChange={() => toggle(sec.key)} className="mt-0.5 accent-brick" />
              <span>
                <span className="text-ink font-medium">{sec.label}</span>
                <span className="text-muted-2"> — {sec.description}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-[12px] text-muted-2 mb-3">
          Teammates given <span className="font-semibold">Sales Training</span> access are automatically emailed an IRS W-9 to complete before they can be paid. You can also send or resend it anytime from their card.
        </p>

        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <Btn type="button" kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" disabled={pending || checked.size === 0}>
            {pending ? "Adding…" : "Add teammate"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

function StaffCard({ staff, sections, isSelf }: { staff: StaffRow; sections: Section[]; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(staff.access));
  const [pending, start] = useTransition();
  const [removing, startRemove] = useTransition();
  const [emailing, startEmail] = useTransition();
  const [sentLabel, setSentLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labelFor = (k: string) => sections.find((s) => s.key === k)?.label ?? k;

  // Pending teammates get a "Resend invite" (account-setup email); active ones
  // get "Send password reset" — same flows as your regular logins.
  function emailAction() {
    setError(null);
    setSentLabel(null);
    startEmail(async () => {
      const res = staff.pending ? await resendPlatformInvite(staff.email) : await sendPlatformPasswordReset(staff.email);
      if (res.error) setError(res.error);
      else setSentLabel(staff.pending ? "Invite sent" : "Reset link sent");
    });
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updatePlatformStaffAccess(staff.id, [...checked]);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm(`Remove ${staff.fullName || staff.email} from platform staff?`)) return;
    setError(null);
    startRemove(async () => {
      const res = await removePlatformStaff(staff.id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="px-5 py-4 border-b border-[#F5F5F5] last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink flex items-center gap-2">
            <span>
              {staff.fullName || staff.email} {isSelf && <span className="text-xs text-muted-2">(you)</span>}
            </span>
            {staff.pending && (
              <span className="text-[11px] font-semibold text-[#B45309] bg-[#FDF3E1] px-2 py-0.5 rounded-full">Pending</span>
            )}
            {staff.w9Status === "requested" && (
              <span className="text-[11px] font-semibold text-[#B45309] bg-[#FDF3E1] px-2 py-0.5 rounded-full">W-9 needed</span>
            )}
            {staff.w9Status === "received" && (
              <span className="text-[11px] font-semibold text-olive bg-olive-tint px-2 py-0.5 rounded-full">W-9 on file</span>
            )}
          </div>
          <div className="text-[13px] text-muted-2 truncate">{staff.email}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {sentLabel ? (
            <span className="text-[13px] font-semibold text-olive">{sentLabel}</span>
          ) : (
            <button type="button" onClick={emailAction} disabled={emailing} className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70 disabled:opacity-50">
              {emailing ? "Sending…" : staff.pending ? "Resend invite" : "Send password reset"}
            </button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70">
            {editing ? "Cancel" : "Edit access"}
          </button>
          {!isSelf && (
            <button type="button" onClick={remove} disabled={removing} className="text-[13px] font-semibold text-brick hover:opacity-70 disabled:opacity-50">
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3">
          <div className="flex flex-col gap-1.5">
            {sections.map((sec) => (
              <label key={sec.key} className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={checked.has(sec.key)} onChange={() => toggle(sec.key)} className="accent-brick" />
                <span className="text-ink">{sec.label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <Btn small disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save access"}
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {staff.access.length > 0 ? (
            staff.access.map((k) => (
              <span key={k} className="text-[11.5px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full">
                {labelFor(k)}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-muted-2">No sections</span>
          )}
        </div>
      )}

      <W9Block staff={staff} />

      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}

const w9Initial: TeamState = { error: null };

// W-9 controls for one staff member: (re)send the request, upload the returned
// form, and view what's on file.
function W9Block({ staff }: { staff: StaffRow }) {
  const [uploadState, uploadAction, uploading] = useActionState(
    async (_prev: TeamState, fd: FormData) => uploadW9(staff.id, fd),
    w9Initial
  );
  const [requesting, startRequest] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function doRequest() {
    setMsg(null);
    setErr(null);
    startRequest(async () => {
      const res = await requestW9(staff.id);
      if (res.error) setErr(res.error);
      else setMsg(staff.w9Status === "none" ? "W-9 request sent" : "W-9 request resent");
    });
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#F5F5F5] flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[11px] font-semibold text-muted-2 uppercase tracking-wide">W-9</span>
      <button type="button" onClick={doRequest} disabled={requesting} className="text-[13px] font-semibold text-charcoal-2 hover:text-brick disabled:opacity-50">
        {requesting ? "Sending…" : staff.w9Status === "none" ? "Send W-9 request" : "Resend W-9 request"}
      </button>
      {staff.hasW9 && (
        <a href={`/admin/team/w9/${staff.id}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-olive hover:opacity-70">
          View W-9
        </a>
      )}
      <form action={uploadAction} className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          required
          className="text-[12px] text-charcoal-2 max-w-[190px] file:mr-2 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-[12px] file:font-semibold file:text-charcoal-2"
        />
        <button type="submit" disabled={uploading} className="text-[13px] font-semibold text-brick hover:opacity-70 disabled:opacity-50">
          {uploading ? "Uploading…" : staff.hasW9 ? "Replace" : "Upload returned W-9"}
        </button>
      </form>
      {msg && <span className="text-[12px] font-semibold text-olive">{msg}</span>}
      {(err || uploadState.error) && <span className="text-[12px] text-danger">{err || uploadState.error}</span>}
    </div>
  );
}
