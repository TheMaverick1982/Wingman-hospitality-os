"use client";

import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { updateStep } from "../actions";

export type EditableStep = {
  id: string;
  step_order: number;
  delay_days: number;
  channel: "email" | "sms";
  subject: string;
  body: string;
  active: boolean;
};

const SMS_LIMIT = 320;

// One step's editor. Channel (Email/SMS) is a client toggle so the subject field
// hides for SMS (an SMS has no subject — the body is the whole message) and the
// body helper text switches to a character count. The form still posts to the
// `updateStep` server action.
export function StepEditor({ step, sequenceId }: { step: EditableStep; sequenceId: string }) {
  const [channel, setChannel] = useState<"email" | "sms">(step.channel);
  const [body, setBody] = useState(step.body);

  return (
    <form action={updateStep} className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
      <input type="hidden" name="stepId" value={step.id} />
      <input type="hidden" name="sequenceId" value={sequenceId} />
      <input type="hidden" name="channel" value={channel} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">
            {channel === "sms" ? "Text" : "Email"} {step.step_order}
          </span>
          <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
            <button
              type="button"
              onClick={() => setChannel("email")}
              className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-md transition-colors ${channel === "email" ? "bg-white text-ink shadow-sm" : "text-muted-2 hover:text-ink"}`}
            >
              <Mail size={13} /> Email
            </button>
            <button
              type="button"
              onClick={() => setChannel("sms")}
              className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-md transition-colors ${channel === "sms" ? "bg-white text-ink shadow-sm" : "text-muted-2 hover:text-ink"}`}
            >
              <MessageSquare size={13} /> SMS
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-charcoal-2">
          Send on day
          <input name="delay_days" type="number" min={0} defaultValue={step.delay_days} className="w-16 text-sm bg-paper border border-line rounded-lg px-2 py-1.5 outline-none focus:border-brick text-ink" />
        </label>
      </div>

      {channel === "email" && (
        <input
          name="subject"
          defaultValue={step.subject}
          placeholder="Subject"
          className="text-sm font-medium bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink"
        />
      )}

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={channel === "sms" ? 3 : 5}
        placeholder={channel === "sms" ? "Hi {{first_name}}, your text message here." : ""}
        className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink resize-y font-[inherit]"
      />

      {channel === "sms" && (
        <p className={`text-[12px] ${body.length > SMS_LIMIT ? "text-danger" : "text-muted-2"}`}>
          {body.length} characters{body.length > 160 ? ` · ~${Math.ceil(body.length / 153)} segments` : ""} · only contacts who opted in to marketing texts receive this. STOP/HELP are handled automatically.
        </p>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[13px] text-charcoal-2">
          <input type="checkbox" name="active" defaultChecked={step.active} className="accent-brick" />
          Active
        </label>
        <button type="submit" className="text-[13px] font-semibold text-white bg-brick rounded-lg px-4 py-2 hover:bg-brick-dark transition-colors">
          Save
        </button>
      </div>
    </form>
  );
}
