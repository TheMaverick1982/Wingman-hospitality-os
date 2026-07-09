"use client";

import { useState, useTransition } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { adminReply, adminSetStatus } from "./actions";

export function AdminReplyForm({ ticketId, status }: { ticketId: string; status: "open" | "pending" | "closed" }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [statusPending, startStatus] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const res = await adminReply(ticketId, body);
      if (res.error) setError(res.error);
      else setBody("");
    });
  }

  function changeStatus(next: "open" | "pending" | "closed") {
    setError(null);
    startStatus(async () => {
      const res = await adminSetStatus(ticketId, next);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Reply to the customer…"
        className={`${inputClass} resize-y`}
      />
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
      <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          {status !== "closed" ? (
            <button
              type="button"
              onClick={() => changeStatus("closed")}
              disabled={statusPending}
              className="font-semibold text-muted hover:text-ink disabled:opacity-50"
            >
              {statusPending ? "…" : "Close"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => changeStatus("open")}
              disabled={statusPending}
              className="font-semibold text-muted hover:text-ink disabled:opacity-50"
            >
              {statusPending ? "…" : "Reopen"}
            </button>
          )}
        </div>
        <Btn disabled={pending || !body.trim()} onClick={send}>
          {pending ? "Sending…" : "Send reply"}
        </Btn>
      </div>
    </div>
  );
}
