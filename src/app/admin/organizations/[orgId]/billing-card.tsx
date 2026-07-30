"use client";

import { useState, useTransition } from "react";
import { sendBillingSetupEmail, setOrgBillingMode, resetOrgBilling, refundCharge } from "../actions";
import { billingBadge } from "@/lib/billing-label";

export type BillingChargeRow = {
  id: string;
  transactionId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  approved: boolean;
  reference: string | null;
  createdAt: string;
};

export function BillingCard({
  orgId,
  isFree,
  billingStatus,
  cardBrand,
  cardLast4,
  charges = [],
}: {
  orgId: string;
  isFree: boolean;
  billingStatus: string;
  cardBrand: string | null;
  cardLast4: string | null;
  charges?: BillingChargeRow[];
}) {
  const [refundPending, startRefund] = useTransition();
  const [refundingId, setRefundingId] = useState<string | null>(null);

  function money(cents: number) {
    return `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
  }
  // A refundable charge: an approved, positive (not itself a refund) transaction
  // that still has a gateway id to reference.
  const isRefundable = (c: BillingChargeRow) => c.approved && c.amountCents > 0 && Boolean(c.transactionId);

  function refund(c: BillingChargeRow) {
    const full = (c.amountCents / 100).toFixed(2);
    const entered = window.prompt(`Refund how much? (max $${full})`, full);
    if (entered == null) return;
    const dollars = Number(entered.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    const cents = Math.round(dollars * 100);
    if (!window.confirm(`Refund ${money(cents)} to this card? This cannot be undone.`)) return;
    setError(null);
    setRefundingId(c.id);
    startRefund(async () => {
      const res = await refundCharge(c.id, cents);
      if (res.error) setError(res.error);
      setRefundingId(null);
    });
  }
  const [emailPending, startEmail] = useTransition();
  const [modePending, startMode] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetBilling() {
    if (!window.confirm("Reset this org's billing to a clean slate? This removes the card on file, stored token, and charge history, and clears the billing period — for clearing out test data. It does not change Free/Paid.")) return;
    setError(null);
    setSent(false);
    startReset(async () => {
      const res = await resetOrgBilling(orgId);
      if (res.error) setError(res.error);
    });
  }

  function sendSetup() {
    setError(null);
    setSent(false);
    startEmail(async () => {
      const res = await sendBillingSetupEmail(orgId);
      if (res.error) setError(res.error);
      else setSent(true);
    });
  }

  function toggleMode() {
    const toPaid = isFree;
    if (!window.confirm(toPaid ? "Mark this organization as a paid account?" : "Move this organization back to free?")) return;
    setError(null);
    startMode(async () => {
      const res = await setOrgBillingMode(orgId, toPaid);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-3">Billing</h2>
      <div className="text-[14px] text-charcoal-2 mb-4">
        Status: <span className="font-semibold text-ink">{billingBadge(isFree, billingStatus).label}</span>
        {cardLast4 && (
          <span className="text-muted-2">
            {" "}
            · {cardBrand ?? "card"} ····{cardLast4}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendSetup}
          disabled={emailPending}
          className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"
        >
          {emailPending ? "Sending…" : "Send billing setup email"}
        </button>
        <button
          type="button"
          onClick={toggleMode}
          disabled={modePending}
          className="text-[13px] font-semibold text-charcoal-2 hover:text-ink disabled:opacity-50"
        >
          {modePending ? "…" : isFree ? "Mark as paid" : "Move to free"}
        </button>
        <button
          type="button"
          onClick={resetBilling}
          disabled={resetPending}
          className="text-[13px] font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
        >
          {resetPending ? "Resetting…" : "Reset billing (testing)"}
        </button>
        {sent && !error && <span className="text-sm text-olive font-semibold">Email sent.</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      <p className="text-[12.5px] text-muted-2 mt-3 leading-relaxed">
        The setup email links customers to a page to add their card. Card capture goes live once your payment processor
        (Global Payments) is connected; &ldquo;Mark as paid&rdquo; is a manual override for comps or cards collected another way.
      </p>

      {charges.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-[13px] font-semibold text-ink mb-2">Charges &amp; refunds</div>
          <div className="flex flex-col divide-y divide-line">
            {charges.map((c) => {
              const isRefund = c.amountCents < 0;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className={`text-[13.5px] font-semibold tabular-nums ${isRefund ? "text-danger" : "text-ink"}`}>{money(c.amountCents)}</span>
                    <span className="text-[12px] text-muted-2">
                      {" "}· {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {c.status}
                      {!c.approved && " (not approved)"}
                    </span>
                    {c.transactionId && <div className="text-[11px] text-muted-2 font-mono truncate">txn {c.transactionId}</div>}
                  </div>
                  {isRefundable(c) && (
                    <button
                      type="button"
                      onClick={() => refund(c)}
                      disabled={refundPending}
                      className="shrink-0 text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-danger hover:text-danger disabled:opacity-50"
                    >
                      {refundPending && refundingId === c.id ? "Refunding…" : "Refund"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[12px] text-muted-2 mt-2">Refunds process a referenced return against the original charge. Partial amounts allowed.</p>
        </div>
      )}
    </div>
  );
}
