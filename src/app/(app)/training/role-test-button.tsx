"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileCheck2, RefreshCw, ArrowRight } from "lucide-react";
import type { Department } from "@/lib/constants";
import { createOrUpdateTestFromRole } from "./tests/actions";

// One-click "turn this role's training into a test" (or update the existing one)
// from the Training page — it lands in the prebuilt tests area, ready to assign.
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

  if (result) {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-[13px] font-semibold text-olive">{result.updated ? "Test updated" : "Test created"}.</span>
        <Link href={`/training/tests/${result.id}/assign`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark">
          Assign it <ArrowRight size={13} />
        </Link>
        <button onClick={go} disabled={pending} className="text-[12.5px] font-semibold text-muted-2 hover:text-ink disabled:opacity-50">
          {pending ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[12.5px] text-danger">{error}</span>}
      <button
        onClick={go}
        disabled={pending || !hasTraining}
        title={!hasTraining ? "Build this role's training first" : undefined}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors disabled:opacity-50"
      >
        {hasTest ? <RefreshCw size={13} /> : <FileCheck2 size={13} />}
        {pending ? (hasTest ? "Updating…" : "Building…") : hasTest ? "Update the test" : "Turn into a test"}
      </button>
    </div>
  );
}
