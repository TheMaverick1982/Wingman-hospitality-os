"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { reseedSharedDemo, type ReseedDemoState } from "./actions";

const initial: ReseedDemoState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink bg-white border border-line rounded-full px-4 py-2 hover:border-brick disabled:opacity-60 transition-colors"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      {pending ? "Refreshing…" : "Refresh sales-demo data"}
    </button>
  );
}

// Platform-only. Forces a fresh reseed of the shared wingmandemo org and shows
// how many example tests + assignments landed — so a rep can un-stale the demo
// (or confirm the tests seeded) in one click, no terminal needed.
export function RefreshDemoButton() {
  const [state, action] = useActionState(reseedSharedDemo, initial);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={action}>
        <Submit />
      </form>
      {state.ok && (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-olive">
          <CheckCircle2 size={14} />
          Reseeded · {state.tests} tests · {state.assignments} assignments
        </span>
      )}
      {state.error && (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-danger">
          <AlertTriangle size={14} />
          {state.error}
        </span>
      )}
    </div>
  );
}
