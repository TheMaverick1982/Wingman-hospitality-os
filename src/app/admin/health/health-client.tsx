"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { resolveError, reopenError } from "./actions";

export type ErrorEvent = {
  id: string;
  fingerprint: string;
  message: string;
  stack: string | null;
  route: string | null;
  source: string;
  org_id: string | null;
  user_email: string | null;
  count: number;
  resolved: boolean;
  first_seen: string;
  last_seen: string;
};

function issueText(e: ErrorEvent): string {
  return [
    "Bug in Wingman (auto-detected by the error monitor).",
    "",
    `Route: ${e.route ?? "unknown"}`,
    `Source: ${e.source}`,
    `Seen: ${e.count}× · first ${new Date(e.first_seen).toLocaleString()} · last ${new Date(e.last_seen).toLocaleString()}`,
    e.user_email ? `Reported by (last): ${e.user_email}` : "",
    "",
    `Error: ${e.message}`,
    "",
    "Stack:",
    (e.stack ?? "(no stack)").split("\n").slice(0, 15).join("\n"),
    "",
    "Please find the root cause and fix it.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function HealthClient({ open, resolved }: { open: ErrorEvent[]; resolved: ErrorEvent[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Open" events={open} emptyMsg="No open bugs. The app is running clean. 🎉" resolvedSection={false} />
      {resolved.length > 0 && <Section title="Resolved" events={resolved} emptyMsg="" resolvedSection={true} />}
    </div>
  );
}

function Section({ title, events, emptyMsg, resolvedSection }: { title: string; events: ErrorEvent[]; emptyMsg: string; resolvedSection: boolean }) {
  return (
    <div>
      <div className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-2">{title}</div>
      {events.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center text-sm text-muted">{emptyMsg}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map((e) => (
            <ErrorRow key={e.id} e={e} resolvedSection={resolvedSection} />
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorRow({ e, resolvedSection }: { e: ErrorEvent; resolvedSection: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issueText(e));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const toggleResolved = () =>
    start(async () => {
      if (resolvedSection) await reopenError(e.id);
      else await resolveError(e.id);
      router.refresh();
    });

  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <button onClick={() => setExpanded((v) => !v)} className="text-muted-2 hover:text-ink mt-0.5 shrink-0" aria-label="Toggle details">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-ink break-words">{e.message}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-muted-2">
            <span className="font-mono text-charcoal-2">{e.route ?? "—"}</span>
            <span className="px-1.5 py-0.5 rounded bg-paper border border-line font-semibold">{e.source}</span>
            <span className="font-semibold text-brick-dark">{e.count}× hits</span>
            <span>last {timeAgo(e.last_seen)}</span>
            {e.user_email && <span>· {e.user_email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick transition-colors"
          >
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy issue</>}
          </button>
          <button
            onClick={toggleResolved}
            disabled={pending}
            className={`text-[12.5px] font-semibold rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 ${
              resolvedSection ? "text-muted border border-line hover:text-ink" : "text-white bg-olive hover:brightness-95"
            }`}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : resolvedSection ? "Reopen" : "Resolve"}
          </button>
        </div>
      </div>
      {expanded && e.stack && (
        <pre className="bg-[#0f0f0f] text-[#e5e5e5] text-[11.5px] leading-[1.5] p-4 overflow-x-auto whitespace-pre-wrap border-t border-[#F1F1F1]">
          {e.stack}
        </pre>
      )}
    </div>
  );
}
