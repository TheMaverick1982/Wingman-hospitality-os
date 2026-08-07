"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Trash2, CornerDownRight, Send } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import type { ManagerThread } from "@/lib/manager-channel";
import { postChannelMessage, deleteChannelMessage } from "./actions";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ManagerChannelClient({ threads }: { threads: ManagerThread[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [pending, start] = useTransition();

  function post() {
    setError(null);
    start(async () => {
      const res = await postChannelMessage({ body });
      if (res.error) setError(res.error);
      else {
        setBody("");
        router.refresh();
      }
    });
  }

  function reply(parentId: string) {
    if (!replyBody.trim()) return;
    start(async () => {
      const res = await postChannelMessage({ body: replyBody, parentId });
      if (!res.error) {
        setReplyBody("");
        setReplyTo(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Remove this message?")) return;
    start(async () => {
      await deleteChannelMessage(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Manager channel</h1>
        <p className="text-base text-muted max-w-xl">
          One place for owners, managers, and shift leads to talk — pass along updates, flag issues, and keep each other
          in the loop. Staff don&rsquo;t see this.
        </p>
      </div>

      <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Share an update with the management team…"
          className={`${inputClass} resize-y`}
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          {error && <span className="text-[12.5px] text-danger mr-auto">{error}</span>}
          <Btn small icon={Send} onClick={post} loading={pending} disabled={pending || body.trim().length < 1}>
            {pending ? "Posting…" : "Post"}
          </Btn>
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <MessagesSquare className="mx-auto text-muted-2 mb-2" size={24} />
          <p className="text-[15px] text-muted">No posts yet. Start the first thread — a heads-up for the next shift, a question for the team, a win worth sharing.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((t) => (
            <div key={t.root.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <Message
                authorName={t.root.authorName}
                body={t.root.body}
                createdAt={t.root.createdAt}
                onDelete={() => remove(t.root.id)}
                pending={pending}
              />

              {t.replies.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-line flex flex-col gap-3">
                  {t.replies.map((r) => (
                    <Message
                      key={r.id}
                      authorName={r.authorName}
                      body={r.body}
                      createdAt={r.createdAt}
                      onDelete={() => remove(r.id)}
                      pending={pending}
                    />
                  ))}
                </div>
              )}

              {replyTo === t.root.id ? (
                <div className="mt-3 pl-4">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="Write a reply…"
                    className={`${inputClass} resize-y`}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button type="button" onClick={() => { setReplyTo(null); setReplyBody(""); }} className="text-[13px] font-semibold text-muted-2 hover:text-ink">
                      Cancel
                    </button>
                    <Btn small onClick={() => reply(t.root.id)} loading={pending} disabled={pending || replyBody.trim().length < 1}>
                      Reply
                    </Btn>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setReplyTo(t.root.id); setReplyBody(""); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick"
                >
                  <CornerDownRight size={14} /> Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Message({
  authorName,
  body,
  createdAt,
  onDelete,
  pending,
}: {
  authorName: string;
  body: string;
  createdAt: string;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-9 h-9 rounded-full bg-brick-tint text-brick-dark flex items-center justify-center text-[13px] font-semibold">
        {initialsOf(authorName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">{authorName}</span>
          <span className="text-[12px] text-muted-2">{timeAgo(createdAt)}</span>
        </div>
        <div className="text-[14.5px] text-ink leading-snug whitespace-pre-wrap mt-0.5">{body}</div>
      </div>
      <button type="button" onClick={onDelete} disabled={pending} className="text-muted-2 hover:text-danger p-1 shrink-0" aria-label="Remove">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
