"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Send } from "lucide-react";
import { updateInterviewInvite, sendTestInvite } from "./applicant-actions";
import {
  DEFAULT_INTERVIEW_INVITE,
  INVITE_SUBJECT_MAX,
  INVITE_BODY_MAX,
  type InterviewInvite,
} from "@/lib/interview-invite";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brick";
const label = "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2 block mb-1";

export function InterviewInvitePanel({ template, testEmail }: { template: InterviewInvite; testEmail: string }) {
  const [draft, setDraft] = useState<InterviewInvite>(template);
  const [msg, setMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string>("");
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateInterviewInvite(draft);
      setMsg(res.error ? res.error : "Saved");
      setTimeout(() => setMsg(null), 2500);
    });
  }
  function sendTest() {
    setTestMsg("");
    start(async () => {
      const res = await sendTestInvite(draft.subject, draft.body);
      setTestMsg(res.error ? res.error : `Sent to ${testEmail}`);
      setTimeout(() => setTestMsg(""), 3500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        When you book an interview from an applicant&rsquo;s card, Wingman can email them the confirmed date, time, and
        location, plus a note to call if anything changes. It&rsquo;s sent from your restaurant&rsquo;s name, and any reply the
        applicant writes goes to your location&rsquo;s email on file — never to Wingman. Edit the wording to sound like you, or
        leave it as-is. (You can uncheck &ldquo;email the applicant&rdquo; on any single booking.)
      </p>
      <div className="text-[12px] text-muted-2 bg-paper border border-line rounded-lg px-3 py-2 leading-relaxed">
        These fill in automatically:{" "}
        <code className="text-charcoal-2">{"{{first_name}}"}</code>,{" "}
        <code className="text-charcoal-2">{"{{restaurant}}"}</code>,{" "}
        <code className="text-charcoal-2">{"{{role}}"}</code>,{" "}
        <code className="text-charcoal-2">{"{{date}}"}</code>,{" "}
        <code className="text-charcoal-2">{"{{time}}"}</code> (in the location&rsquo;s time zone),{" "}
        <code className="text-charcoal-2">{"{{location}}"}</code>,{" "}
        <code className="text-charcoal-2">{"{{address}}"}</code>,{" "}
        <code className="text-charcoal-2">{"{{phone}}"}</code>, and{" "}
        <code className="text-charcoal-2">{"{{details}}"}</code> (what you type in the “Details” box when scheduling).
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[14px] font-semibold text-ink">Interview invitation email</div>
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_INTERVIEW_INVITE })}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-2 hover:text-brick"
          >
            <RotateCcw size={12} /> Reset to default
          </button>
        </div>
        <label className={label}>Subject</label>
        <input value={draft.subject} maxLength={INVITE_SUBJECT_MAX} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} className={field} />
        <label className={`${label} mt-3`}>Message</label>
        <textarea value={draft.body} maxLength={INVITE_BODY_MAX} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} rows={12} className={`${field} leading-relaxed`} />
        {testEmail && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={sendTest}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick disabled:opacity-50"
              title={`Send a preview of this email to ${testEmail}`}
            >
              <Send size={12} /> Send test to me
            </button>
            {testMsg && (
              <span className={`text-[12px] font-semibold ${testMsg.startsWith("Sent") ? "text-olive" : "text-danger"}`}>{testMsg}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
          {pending ? "Saving…" : "Save invitation email"}
        </button>
        {msg && <span className={`text-[12.5px] font-semibold ${msg === "Saved" ? "text-olive" : "text-danger"}`}>{msg}</span>}
      </div>
    </div>
  );
}
