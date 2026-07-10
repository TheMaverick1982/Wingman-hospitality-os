"use client";

import { useState, useTransition } from "react";
import { runPayout, syncPayoutStatus } from "./payout-actions";

export type EligibleRow = { id: string; name: string; paypalEmail: string; owedCents: number };
export type PayoutHistoryRow = { id: string; name: string; amountCents: number; status: string; batchId: string | null; createdAt: string };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayoutsPanel({
  paypalReady,
  minDollars,
  eligible,
  history,
}: {
  paypalReady: boolean;
  minDollars: number;
  eligible: EligibleRow[];
  history: PayoutHistoryRow[];
}) {
  return (
    <section className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-ink">Payouts</h2>
        {!paypalReady && (
          <span className="text-[12px] font-semibold text-[#B45309] bg-[#FDF3E1] px-2.5 py-1 rounded-full">
            PayPal not configured
          </span>
        )}
      </div>

      {!paypalReady && (
        <p className="text-sm text-muted mb-5">
          Add <span className="font-mono">PAYPAL_CLIENT_ID</span>, <span className="font-mono">PAYPAL_CLIENT_SECRET</span>, and{" "}
          <span className="font-mono">PAYPAL_ENV</span> in Vercel to enable sending payouts.
        </p>
      )}

      <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-2">
        Ready to pay <span className="text-muted-2 font-normal normal-case">(approved balance ≥ ${minDollars}, PayPal on file)</span>
      </div>
      {eligible.length === 0 ? (
        <p className="text-sm text-muted mb-6">No affiliates are ready for payout yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {eligible.map((e) => (
            <EligibleCard key={e.id} e={e} disabled={!paypalReady} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-2">Recent payouts</div>
          <div className="flex flex-col gap-1.5">
            {history.map((h) => (
              <HistoryRow key={h.id} h={h} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EligibleCard({ e, disabled }: { e: EligibleRow; disabled: boolean }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    if (!window.confirm(`Send ${money(e.owedCents)} to ${e.name} (${e.paypalEmail}) via PayPal?`)) return;
    setError(null);
    start(async () => {
      const res = await runPayout(e.id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-paper">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink truncate">{e.name}</div>
        <div className="text-[12.5px] text-muted-2 truncate">{e.paypalEmail}</div>
        {error && <div className="text-[12.5px] text-danger mt-0.5">{error}</div>}
      </div>
      <button
        type="button"
        onClick={pay}
        disabled={busy || disabled}
        className="shrink-0 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"
      >
        {busy ? "Sending…" : `Pay ${money(e.owedCents)}`}
      </button>
    </div>
  );
}

function HistoryRow({ h }: { h: PayoutHistoryRow }) {
  const [busy, start] = useTransition();
  const badge =
    h.status === "success"
      ? "text-olive bg-olive-tint"
      : h.status === "failed"
        ? "text-danger bg-danger-tint"
        : "text-[#B45309] bg-[#FDF3E1]";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border border-[#F1F1F1] rounded-xl">
      <div className="min-w-0">
        <span className="text-[14px] text-ink">{h.name}</span>
        <span className="text-[13px] text-muted-2"> · {money(h.amountCents)}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full capitalize ${badge}`}>{h.status}</span>
        {h.status === "processing" && (
          <button
            type="button"
            onClick={() => start(async () => void (await syncPayoutStatus(h.id)))}
            disabled={busy}
            className="text-[12.5px] font-semibold text-charcoal-2 hover:opacity-70 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        )}
      </div>
    </div>
  );
}
