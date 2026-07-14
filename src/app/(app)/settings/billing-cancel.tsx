"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { cancelSubscription, resumeSubscription } from "./actions";

// Self-serve cancel / resume. Cancellation is scheduled for the end of the
// current billing period (access continues until then). If the org has live API
// integrations, the confirm reminds them to disconnect so data stops flowing.
export function BillingCancel({ canceled, hasApi }: { canceled: boolean; hasApi: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (canceled) {
    return (
      <div className="mt-5 pt-5 border-t border-line">
        <div className="flex items-start gap-2 rounded-lg border border-[#F5C2C0] bg-[#FDECEA] px-4 py-3 mb-3">
          <AlertTriangle size={16} className="text-[#B42318] shrink-0 mt-0.5" />
          <p className="text-sm text-[#912018]">
            Your subscription is set to <strong>cancel at the end of the current billing period</strong>. You keep full
            access until then and won&apos;t be charged again.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setErr(null);
            start(async () => {
              const res = await resumeSubscription();
              if (res.error) setErr(res.error);
            });
          }}
          className="inline-flex items-center rounded-lg bg-brick text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Resuming..." : "Resume subscription"}
        </button>
        {err && <p className="text-sm text-danger mt-2">{err}</p>}
      </div>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-line">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const msg = hasApi
            ? "Cancel your Wingman subscription at the end of the current billing period?\n\nYou also have an API integration connected (your POS / Zapier). After cancelling, disconnect it under Settings → API access so it stops sending data."
            : "Cancel your Wingman subscription at the end of the current billing period? You'll keep access until then.";
          if (!window.confirm(msg)) return;
          setErr(null);
          start(async () => {
            const res = await cancelSubscription();
            if (res.error) setErr(res.error);
          });
        }}
        className="text-sm font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
      >
        {pending ? "Cancelling..." : "Cancel subscription"}
      </button>
      {err && <p className="text-sm text-danger mt-2">{err}</p>}
    </div>
  );
}
