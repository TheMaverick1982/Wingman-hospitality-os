"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Send } from "lucide-react";
import { updateReplyTemplates, sendTestReply } from "./applicant-actions";
import {
  REPLY_KINDS,
  REPLY_KIND_LABEL,
  DEFAULT_REPLY_TEMPLATES,
  SUBJECT_MAX,
  BODY_MAX,
  type ReplyKind,
  type ReplyTemplates,
} from "@/lib/applicant-reply";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brick";
const label = "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2 block mb-1";

export function ReplyTemplatesPanel({ templates, testEmail }: { templates: ReplyTemplates; testEmail: string }) {
  const [draft, setDraft] = useState<ReplyTemplates>(templates);
  const [msg, setMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Partial<Record<ReplyKind, string>>>({});
  const [pending, start] = useTransition();

  function set(kind: ReplyKind, key: "subject" | "body", value: string) {
    setDraft((d) => ({ ...d, [kind]: { ...d[kind], [key]: value } }));
  }
  function resetOne(kind: ReplyKind) {
    setDraft((d) => ({ ...d, [kind]: { ...DEFAULT_REPLY_TEMPLATES[kind] } }));
  }
  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateReplyTemplates(draft);
      setMsg(res.error ? res.error : "Saved");
      setTimeout(() => setMsg(null), 2500);
    });
  }
  function sendTest(kind: ReplyKind) {
    setTestMsg((m) => ({ ...m, [kind]: "" }));
    start(async () => {
      const res = await sendTestReply(kind, draft[kind].subject, draft[kind].body);
      setTestMsg((m) => ({ ...m, [kind]: res.error ? res.error : `Sent to ${testEmail}` }));
      setTimeout(() => setTestMsg((m) => ({ ...m, [kind]: "" })), 3500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        These are the two emails you can send an applicant with one click from their card — a warm{" "}
        <span className="font-semibold text-charcoal-2">“{REPLY_KIND_LABEL.interested}”</span> note and a gracious{" "}
        <span className="font-semibold text-charcoal-2">“{REPLY_KIND_LABEL.not_a_fit}”</span> note. Edit them to sound like you, or leave them as-is.
        Each is sent from your restaurant&rsquo;s name, addresses the applicant by their first name, and any reply the applicant writes back goes to
        your location&rsquo;s email on file — never to Wingman.
      </p>
      <div className="text-[12px] text-muted-2 bg-paper border border-line rounded-lg px-3 py-2">
        You can drop these into the text and they fill in automatically:{" "}
        <code className="text-charcoal-2">{"{{first_name}}"}</code> (the applicant&rsquo;s first name, or “there” if they didn&rsquo;t give one or it&rsquo;s inappropriate),{" "}
        <code className="text-charcoal-2">{"{{restaurant}}"}</code> (your name), and{" "}
        <code className="text-charcoal-2">{"{{role}}"}</code> (the role they applied for).
      </div>

      {REPLY_KINDS.map((kind) => (
        <div key={kind} className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[14px] font-semibold text-ink">“{REPLY_KIND_LABEL[kind]}” email</div>
            <button
              type="button"
              onClick={() => resetOne(kind)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-2 hover:text-brick"
            >
              <RotateCcw size={12} /> Reset to default
            </button>
          </div>
          <label className={label}>Subject</label>
          <input value={draft[kind].subject} maxLength={SUBJECT_MAX} onChange={(e) => set(kind, "subject", e.target.value)} className={field} />
          <label className={`${label} mt-3`}>Message</label>
          <textarea value={draft[kind].body} maxLength={BODY_MAX} onChange={(e) => set(kind, "body", e.target.value)} rows={8} className={`${field} leading-relaxed`} />
          {testEmail && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => sendTest(kind)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick disabled:opacity-50"
                title={`Send a preview of this email to ${testEmail}`}
              >
                <Send size={12} /> Send test to me
              </button>
              {testMsg[kind] && (
                <span className={`text-[12px] font-semibold ${testMsg[kind]?.startsWith("Sent") ? "text-olive" : "text-danger"}`}>{testMsg[kind]}</span>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
          {pending ? "Saving…" : "Save reply emails"}
        </button>
        {msg && <span className={`text-[12.5px] font-semibold ${msg === "Saved" ? "text-olive" : "text-danger"}`}>{msg}</span>}
      </div>
    </div>
  );
}
