"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRM_STAGES, sourceLabel, type CrmStage, type CrmActivityKind } from "@/lib/crm";
import { moveContactStage, addNote, sendContactEmail, type CrmActionState } from "../actions";

export type ContactRecord = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  stage: CrmStage;
  first_source: string | null;
  unsubscribed: boolean;
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

const initial: CrmActionState = { error: null, ok: false };

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ContactPanel({ contact, activities }: { contact: ContactRecord; activities: ActivityRecord[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "note">("email");
  const [savingStage, setSavingStage] = useState(false);

  const [emailState, emailAction, emailPending] = useActionState(sendContactEmail, initial);
  const [noteState, noteAction, notePending] = useActionState(addNote, initial);
  const emailFormRef = useRef<HTMLFormElement>(null);
  const noteFormRef = useRef<HTMLFormElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // After a successful send/note the server revalidates; reset the form + refresh.
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
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
  }, [activities.length]);

  async function onStage(e: React.ChangeEvent<HTMLSelectElement>) {
    setSavingStage(true);
    await moveContactStage(contact.id, e.target.value);
    setSavingStage(false);
    router.refresh();
  }

  const title = contact.name || contact.email;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
      {/* Left: contact summary */}
      <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center text-sm font-semibold">
            {title.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-ink truncate">{title}</div>
            <div className="text-[12.5px] text-muted-2 truncate">{contact.email}</div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Stage</label>
          <select
            defaultValue={contact.stage}
            onChange={onStage}
            disabled={savingStage}
            className="mt-1 w-full text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink"
          >
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
          {contact.phone && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-2">Phone</dt>
              <dd className="text-ink font-medium text-right">{contact.phone}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-2">Added</dt>
            <dd className="text-ink font-medium text-right">{new Date(contact.created_at).toLocaleDateString()}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-2">Emailable</dt>
            <dd className={`font-medium text-right ${contact.unsubscribed ? "text-danger" : "text-ink"}`}>
              {contact.unsubscribed ? "Unsubscribed" : "Yes"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Right: timeline + composer */}
      <div className="bg-white border border-line rounded-2xl flex flex-col overflow-hidden">
        <div ref={timelineRef} className="px-5 py-5 flex flex-col gap-3 max-h-[52vh] overflow-y-auto">
          {activities.length === 0 && <p className="text-sm text-muted text-center py-6">No activity yet.</p>}
          {activities.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
        </div>

        {/* Composer */}
        <div className="border-t border-line p-4">
          <div className="flex gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setTab("email")}
              className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${tab === "email" ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setTab("note")}
              className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${tab === "note" ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"}`}
            >
              Note
            </button>
          </div>

          {tab === "email" ? (
            <form ref={emailFormRef} action={emailAction} className="flex flex-col gap-2">
              <input type="hidden" name="contactId" value={contact.id} />
              <input
                name="subject"
                placeholder="Subject"
                required
                disabled={contact.unsubscribed}
                className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink placeholder:text-muted-2"
              />
              <textarea
                name="body"
                placeholder={contact.unsubscribed ? "This contact has unsubscribed." : "Write your message…"}
                required
                rows={4}
                disabled={contact.unsubscribed}
                className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink placeholder:text-muted-2 resize-y"
              />
              <div className="flex items-center justify-between">
                {emailState.error ? <span className="text-[12.5px] text-danger">{emailState.error}</span> : <span />}
                <button
                  type="submit"
                  disabled={emailPending || contact.unsubscribed}
                  className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark disabled:opacity-40 transition-colors"
                >
                  {emailPending ? "Sending…" : "Send email"}
                </button>
              </div>
            </form>
          ) : (
            <form ref={noteFormRef} action={noteAction} className="flex flex-col gap-2">
              <input type="hidden" name="contactId" value={contact.id} />
              <textarea
                name="body"
                placeholder="Add an internal note…"
                required
                rows={3}
                className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink placeholder:text-muted-2 resize-y"
              />
              <div className="flex items-center justify-between">
                {noteState.error ? <span className="text-[12.5px] text-danger">{noteState.error}</span> : <span />}
                <button
                  type="submit"
                  disabled={notePending}
                  className="text-[13px] font-semibold text-ink bg-paper border border-line-strong rounded-lg px-4 py-2 hover:bg-white disabled:opacity-40 transition-colors"
                >
                  {notePending ? "Saving…" : "Add note"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ a }: { a: ActivityRecord }) {
  if (a.kind === "email_out" || a.kind === "email_in") {
    const outbound = a.kind === "email_out";
    return (
      <div className={`max-w-[85%] ${outbound ? "self-end" : "self-start"}`}>
        <div className={`rounded-2xl px-4 py-3 ${outbound ? "bg-brick text-white rounded-tr-sm" : "bg-paper text-ink rounded-tl-sm"}`}>
          {a.subject && <div className={`text-[13px] font-semibold mb-1 ${outbound ? "text-white" : "text-ink"}`}>{a.subject}</div>}
          <div className="text-[13.5px] leading-[1.5] whitespace-pre-line">{a.body}</div>
        </div>
        <div className={`text-[11px] text-muted-2 mt-1 ${outbound ? "text-right" : ""}`}>
          {outbound ? "Sent" : "Received"} · {when(a.created_at)}
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

  // lead / stage_change / system → centered muted line
  return (
    <div className="self-center text-[12px] text-muted-2 bg-paper rounded-full px-3 py-1">
      {a.body} · {when(a.created_at)}
    </div>
  );
}
