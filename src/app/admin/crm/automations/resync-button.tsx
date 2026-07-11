"use client";

import { useActionState } from "react";
import { resyncSpecCopy, type ResyncState } from "./actions";

const initial: ResyncState = { done: false, message: null };

// Resync button that confirms when the spec copy has been reseeded.
export function ResyncButton() {
  const [state, action, pending] = useActionState(resyncSpecCopy, initial);

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors disabled:opacity-60"
        title="Load the latest spec copy into the demo, calculator, scorecard, signup and no-show sequences. Leaves everything in draft; won't touch sequences you've already published."
      >
        {pending ? "Syncing…" : "Resync spec copy"}
      </button>
      {state.done && state.message && (
        <span className="text-[12px] font-semibold text-olive">✓ {state.message}</span>
      )}
    </form>
  );
}
