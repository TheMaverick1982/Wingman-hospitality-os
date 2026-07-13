"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileCheck2, RefreshCw, ArrowRight, Loader2, Pencil } from "lucide-react";
import type { Department } from "@/lib/constants";
import { createOrUpdateTestFromRole } from "./tests/actions";

// One-click "turn this role's training into a test" (or update the existing one)
// from the Training page — it lands in the prebuilt tests area, ready to review,
// edit, and assign.
export function RoleTestButton({ department, hasTest, hasTraining }: { department: Department; hasTest: boolean; hasTraining: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ id: string; updated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    start(async () => {
      const res = await createOrUpdateTestFromRole(department);
      if (res.error) setError(res.error);
      else if (res.id) setResult({ id: res.id, updated: Boolean(res.updated) });
    });
  }

  // While the AI writes the questions, show a clear "working on it" message so the
  // owner knows it's running (it can take 10–20 seconds) and doesn't think it stalled.
  if (pending) {
    return (
      <div className="flex items-center gap-2 text-[13px] font-semibold text-brick-dark bg-brick-tint/60 border border-brick/20 rounded-full px-3.5 py-1.5">
        <Loader2 size={14} className="animate-spin shrink-0" />
        <span>{hasTest ? "Rewriting" : "Building"} the {department} test from your standards… this takes a few seconds. Please don&rsquo;t refresh.</span>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-[13px] font-semibold text-olive">{result.updated ? "Test ready" : "Test built"} — review it before you assign.</span>
        <Link href={`/training/tests/${result.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark">
          <Pencil size={13} /> Review &amp; edit
        </Link>
        <Link href={`/training/tests/${result.id}/assign`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick">
          Assign it <ArrowRight size={13} />
        </Link>
        <button onClick={go} className="text-[12.5px] font-semibold text-muted-2 hover:text-ink">
          Regenerate
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[12.5px] text-danger">{error}</span>}
      <button
        onClick={go}
        disabled={!hasTraining}
        title={!hasTraining ? "Build this role's training first" : undefined}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors disabled:opacity-50"
      >
        {hasTest ? <RefreshCw size={13} /> : <FileCheck2 size={13} />}
        {hasTest ? "Update the test" : "Turn into a test"}
      </button>
    </div>
  );
}
