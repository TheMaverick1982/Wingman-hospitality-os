"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileCheck2, RefreshCw, ArrowRight, Loader2, Pencil } from "lucide-react";
import { createOrUpdateTestFromRecipe } from "../../tests/actions";

// One-click "turn this recipe into a test" (or update the existing one) from a
// dish's recipe page — it lands in the prebuilt tests area, ready to review,
// edit, and assign, so a cook can prove they know how to make the dish to spec.
export function RecipeTestButton({ menuItemId, hasTest, hasSteps }: { menuItemId: string; hasTest: boolean; hasSteps: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ id: string; updated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    start(async () => {
      const res = await createOrUpdateTestFromRecipe(menuItemId);
      if (res.error) setError(res.error);
      else if (res.id) setResult({ id: res.id, updated: Boolean(res.updated) });
    });
  }

  // The AI takes 10–20s to write the questions; show a clear "working" state so
  // the manager knows it's running and doesn't refresh.
  if (pending) {
    return (
      <div className="flex items-center gap-2 text-[13px] font-semibold text-brick-dark bg-brick-tint/60 border border-brick/20 rounded-full px-3.5 py-1.5">
        <Loader2 size={14} className="animate-spin shrink-0" />
        <span>{hasTest ? "Rewriting" : "Building"} the test from this recipe… this takes a few seconds. Please don&rsquo;t refresh.</span>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
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
    <div className="flex items-center gap-2 flex-wrap">
      {error && <span className="text-[12.5px] text-danger">{error}</span>}
      <button
        onClick={go}
        disabled={!hasSteps}
        title={!hasSteps ? "Add recipe steps first" : undefined}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors disabled:opacity-50"
      >
        {hasTest ? <RefreshCw size={13} /> : <FileCheck2 size={13} />}
        {hasTest ? "Update the recipe test" : "Turn into a test"}
      </button>
    </div>
  );
}
