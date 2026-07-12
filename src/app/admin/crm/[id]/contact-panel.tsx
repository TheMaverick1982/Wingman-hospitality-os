"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRM_STAGES, sourceLabel, leadResultRows, type CrmStage, type CrmActivityKind } from "@/lib/crm";
import {
  moveContactStage,
  addNote,
  sendContactEmail,
  updateContactDetails,
  markContactBooked,
  unsubscribeContact,
  deleteContact,
  type CrmActionState,
} from "../actions";

export type ContactRecord = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
  stage: CrmStage;
  first_source: string | null;
  unsubscribed: boolean;
  booked_at: string | null;
  customer_at: string | null;
  org_id: string | null;
  created_at: string;
};

export type ActivityRecord = {
  id: string;
  kind: CrmActivityKind;
  subject: string | null;
  body: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type EnrollmentRecord = {
  id: string;
  status: string;
  stopped_reason: string | null;
  next_run_at: string;
  crm_sequences: { name: string; source: string } | null;
};

const initial: CrmActionState = { error: null, ok: false };

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ContactPanel({ contact, activities, enrollments, canDelete }: { contact: ContactRecord; activities: ActivityRecord[]; enrollments: EnrollmentRecord[]; canDelete: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "note">("email");
  const [savingStage, setSavingStage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [detailsState, detailsAction, detailsPending] = useActionState(updateContactDetails, initial);
  const [emailState, emailAction, emailPending] = useActionState(sendContactEmail, initial);
  const [noteState, noteAction, notePending] = useActionState(addNote, initial);
  const emailFormRef = useRef<HTMLFormElement>(null);
  const noteFormRef = useRef<HTMLFormElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (emailState.ok) {
      emailFormRef.current?.reset();
      router.refresh();
    }
  }, [emailState, router]);
  useEffect(() => {
    if (noteState.ok) {
      noteFormRef.current?.reset();
      router.refresh();
    }
  }, [noteState, router]);
  useEffect(() => {
    if (detailsState.ok) router.refresh();
  }, [detailsState, router]);
  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
  }, [activities.length]);

  async function onStage(e: React.ChangeEvent<HTMLSelectElement>) {
    setSavingStage(true);
    await moveContactStage(contact.id, e.target.value);
    setSavingStage(false);
    router.refresh();
  }

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    await fn();
    setBusy(null);
    router.refresh();
  }

  const title = contact.name || contact.email;
  const statusLabel = contact.customer_at ? "Customer" : contact.booked_at ? "Booked a call" : contact.unsubscribed ? "Unsubscribed" : "In pipeline";
  const activeEnrollments = enrollments.filter((e) => e.status === "active");

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Editable details */}
          <form action={detailsAction} className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
            <input type="hidden" name="contactId" value={contact.id} />
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center text-sm font-semibold">
                {title.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-ink truncate">{title}</div>
                <a href={`mailto:${contact.email}`} className="text-[12.5px] text-brick hover:opacity-70 truncate block">
                  {contact.email}
                </a>
              </div>
            </div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Name</label>
            <input name="name" defaultValue={contact.name ?? ""} placeholder="Full name" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink placeholder:text-muted-2" />

            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Phone</label>
            <input name="phone" defaultValue={contact.phone ?? ""} placeholder="(555) 555-5555" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink placeholder:text-muted-2" />

            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Notes</label>
            <textarea name="notes" defaultValue={contact.notes ?? ""} rows={3} placeholder="Anything worth remembering about this contact…" className="text-sm bg-paper border border-line rounded-lg px-3 py-2 -mt-1.5 outline-none focus:border-brick text-ink placeholder:text-muted-2 resize-y" />

            <div className="flex items-center justify-between">
              {detailsState.error ? <span className="text-[12px] text-danger">{detailsState.error}</span> : <span className="text-[12px] text-olive">{detailsState.ok ? "Saved" : ""}</span>}
              <button type="submit" disabled={detailsPending} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-1.5 hover:bg-brick-dark disabled:opacity-40 transition-colors">
                {detailsPending ? "Saving…" : "Save details"}
              </button>
            </div>
          </form>

          {/* Stage + meta */}
          <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Stage</label>
              <select defaultValue={contact.stage} onChange={onStage} disabled={savingStage} className="mt-1 w-full text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink">
                {CRM_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-2">Source</dt>
                <dd className="text-ink font-medium text-right">{sourceLabel(contact.first_source)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-2">Status</dt>
                <dd className={`font-medium text-right ${contact.unsubscribed ? "text-danger" : "text-ink"}`}>{statusLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-2">Added</dt>
                <dd className="text-ink font-medium text-right">{new Date(contact.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Automations */}
          <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Automations</span>
            {enrollments.length === 0 ? (
              <p className="text-[13px] text-muted-2">Not in any sequence.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {enrollments.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-ink font-medium truncate">{e.crm_sequences?.name ?? "Sequence"}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${e.status === "active" ? "text-olive bg-olive-tint" : "text-muted-2 bg-paper border border-line"}`}>
                      {e.status === "active" ? `next ${new Date(e.next_run_at).toLocaleDateString()}` : e.stopped_reason ?? e.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {!contact.booked_at && activeEnrollments.length > 0 && (
                <button type="button" disabled={busy === "booked"} onClick={() => run("booked", () => markContactBooked(contact.id))} className="text-[12px] font-semibold text-ink bg-paper border border-line-strong rounded-lg px-3 py-1.5 hover:bg-white disabled:opacity-40 transition-colors">
                  Mark booked
                </button>
              )}
              {!contact.unsubscribed && (
                <button type="button" disabled={busy === "unsub"} onClick={() => run("unsub", () => unsubscribeContact(contact.id))} className="text-[12px] font-medium text-danger hover:opacity-70 disabled:opacity-40 transition-opacity px-2 py-1.5">
                  Unsubscribe
                </button>
              )}
            </div>
          </div>

          {canDelete && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-[13px] font-medium text-danger hover:opacity-70 transition-opacity self-start px-1">
              Delete contact
            </button>
          )}
        </div>

        {/* Right column: timeline + composer */}
        <div className="bg-white border border-line rounded-2xl flex flex-col overflow-hidden">
          <div ref={timelineRef} className="px-5 py-5 flex flex-col gap-3 max-h-[56vh] overflow-y-auto">
            {activities.length === 0 && <p className="text-sm text-muted text-center py-6">No activity yet.</p>}
            {activities.map((a) => (
              <ActivityRow key={a.id} a={a} />
            ))}
          </div>

          <div className="border-t border-line p-4">
            <div className="flex gap-1.5 mb-3">
              <button type="button" onClick={() => setTab("email")} className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${tab === "email" ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"}`}>
                Email
              </button>
              <button type="button" onClick={() => setTab("note")} className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${tab === "note" ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"}`}>
                Note
              </button>
            </div>

            {tab === "email" ? (
              <form ref={emailFormRef} action={emailAction} className="flex flex-col gap-2">
                <input type="hidden" name="contactId" value={contact.id} />
                <input name="subject" placeholder="Subject" required disabled={contact.unsubscribed} className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink placeholder:text-muted-2" />
                <textarea name="body" placeholder={contact.unsubscribed ? "This contact has unsubscribed." : "Write your message…"} required rows={4} disabled={contact.unsubscribed} className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink placeholder:text-muted-2 resize-y" />
                <div className="flex items-center justify-between">
                  {emailState.error ? <span className="text-[12.5px] text-danger">{emailState.error}</span> : <span />}
                  <button type="submit" disabled={emailPending || contact.unsubscribed} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark disabled:opacity-40 transition-colors">
                    {emailPending ? "Sending…" : "Send email"}
                  </button>
                </div>
              </form>
            ) : (
              <form ref={noteFormRef} action={noteAction} className="flex flex-col gap-2">
                <input type="hidden" name="contactId" value={contact.id} />
                <textarea name="body" placeholder="Add an internal note…" required rows={3} className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink placeholder:text-muted-2 resize-y" />
                <div className="flex items-center justify-between">
                  {noteState.error ? <span className="text-[12.5px] text-danger">{noteState.error}</span> : <span />}
                  <button type="submit" disabled={notePending} className="text-[13px] font-semibold text-ink bg-paper border border-line-strong rounded-lg px-4 py-2 hover:bg-white disabled:opacity-40 transition-colors">
                    {notePending ? "Saving…" : "Add note"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-[400px] w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[17px] font-semibold text-ink mb-2">Delete this contact?</div>
            <p className="text-sm text-muted mb-5">
              This permanently removes <span className="font-semibold text-ink">{title}</span> and their entire history — notes, emails, and timeline. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[13px] font-semibold text-charcoal-2 px-4 py-2 rounded-lg hover:bg-paper transition-colors">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={() => run("delete", () => deleteContact(contact.id))}
                className="text-[13px] font-semibold text-white bg-danger rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {busy === "delete" ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActivityRow({ a }: { a: ActivityRecord }) {
  if (a.kind === "email_out" || a.kind === "email_in") {
    const outbound = a.kind === "email_out";
    const automated = Boolean((a.meta as { automated?: boolean })?.automated);
    return (
      <div className={`max-w-[85%] ${outbound ? "self-end" : "self-start"}`}>
        <div className={`rounded-2xl px-4 py-3 ${outbound ? "bg-brick text-white rounded-tr-sm" : "bg-paper text-ink rounded-tl-sm"}`}>
          {a.subject && <div className={`text-[13px] font-semibold mb-1 ${outbound ? "text-white" : "text-ink"}`}>{a.subject}</div>}
          <div className="text-[13.5px] leading-[1.5] whitespace-pre-line">{a.body}</div>
        </div>
        <div className={`text-[11px] text-muted-2 mt-1 ${outbound ? "text-right" : ""}`}>
          {automated ? "Automation" : outbound ? "Sent" : "Received"} · {when(a.created_at)}
        </div>
      </div>
    );
  }

  if (a.kind === "note") {
    return (
      <div className="self-stretch bg-gold-tint rounded-xl px-3.5 py-2.5">
        <div className="text-[13px] text-[#8a5a00] whitespace-pre-line">{a.body}</div>
        <div className="text-[11px] text-[#b4884a] mt-1">Note · {when(a.created_at)}</div>
      </div>
    );
  }

  if (a.kind === "lead") {
    const source = (a.meta as { source?: string })?.source;
    const rows = leadResultRows(source, a.meta);
    return (
      <div className="self-stretch bg-paper border border-line rounded-xl px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-ink">Lead captured via {sourceLabel(source)}</span>
          <span className="text-[11px] text-muted-2">{when(a.created_at)}</span>
        </div>
        {rows.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-2 text-[12.5px]">
                <dt className="text-muted-2">{r.label}</dt>
                <dd className="text-ink font-medium text-right">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className="self-center text-[12px] text-muted-2 bg-paper rounded-full px-3 py-1">
      {a.body} · {when(a.created_at)}
    </div>
  );
}
