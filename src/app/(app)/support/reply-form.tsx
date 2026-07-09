"use client";

import { useState, useTransition } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { replyToTicket, setTicketStatus } from "./actions";

export function ReplyForm({ ticketId, status }: { ticketId: string; status: "open" | "pending" | "closed" }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [statusPending, startStatus] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const res = await replyToTicket(ticketId, body);
      if (res.error) setError(res.error);
      else setBody("");
    });
  }

  function changeStatus(next: "open" | "closed") {
    setError(null);
    startStatus(async () => {
      const res = await setTicketStatus(ticketId, next);
      if (res.error) setError(res.error);
    });
  }

  if (status === "closed") {
    return (
      <div className="bg-paper border border-line rounded-2xl p-5 text-center">
        <p className="text-sm text-muted mb-3">This ticket is closed.</p>
        <Btn kind="ghost" disabled={statusPending} onClick={() => changeStatus("open")}>
          {statusPending ? "Reopening…" : "Reopen ticket"}
        </Btn>
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write a reply…"
        className={`${inputClass} resize-y`}
      />
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
      <div className="flex items-center justify-between gap-2 mt-3">
        <button
          type="button"
          onClick={() => changeStatus("closed")}
          disabled={statusPending}
          className="text-sm font-semibold text-muted hover:text-ink disabled:opacity-50"
        >
          {statusPending ? "Closing…" : "Close ticket"}
        </button>
        <Btn disabled={pending || !body.trim()} onClick={send}>
          {pending ? "Sending…" : "Send reply"}
        </Btn>
      </div>
    </div>
  );
}
