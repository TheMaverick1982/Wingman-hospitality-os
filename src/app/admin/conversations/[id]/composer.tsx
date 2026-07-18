"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare, Send } from "lucide-react";
import { sendEmailAction, sendSmsAction } from "../actions";

export function ConversationComposer({ contactId, hasEmail, hasPhone }: { contactId: string; hasEmail: boolean; hasPhone: boolean }) {
  // Default to whichever channel is available.
  const [channel, setChannel] = useState<"email" | "sms">(hasEmail ? "email" : "sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function send() {
    setError(null);
    start(async () => {
      const res = channel === "email" ? await sendEmailAction(contactId, subject, body) : await sendSmsAction(contactId, body);
      if (!res.ok) {
        setError(res.error ?? "Couldn't send.");
        return;
      }
      setSubject("");
      setBody("");
      router.refresh();
    });
  }

  const tab = (c: "email" | "sms", label: string, icon: React.ReactNode, enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => setChannel(c)}
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 ${channel === c ? "bg-white text-ink shadow-sm" : "text-muted-2 hover:text-ink"}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="bg-white border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="inline-flex rounded-lg border border-line bg-paper p-0.5 w-fit">
        {tab("email", "Email", <Mail size={13} />, hasEmail)}
        {tab("sms", "SMS", <MessageSquare size={13} />, hasPhone)}
      </div>

      {channel === "email" && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="text-sm font-medium bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink"
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={channel === "sms" ? 3 : 5}
        placeholder={channel === "sms" ? "Write a text…" : "Write an email…"}
        className="text-sm bg-paper border border-line rounded-lg px-3 py-2 outline-none focus:border-brick text-ink resize-y font-[inherit]"
      />

      {channel === "sms" && (
        <p className="text-[12px] text-muted-2">{body.length} characters{body.length > 160 ? ` · ~${Math.ceil(body.length / 153)} segments` : ""}</p>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim() || (channel === "email" && !subject.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-brick text-white font-semibold px-5 py-2 text-sm hover:bg-brick-dark transition-colors disabled:opacity-40"
        >
          <Send size={14} /> {pending ? "Sending…" : `Send ${channel === "sms" ? "text" : "email"}`}
        </button>
      </div>
    </div>
  );
}
