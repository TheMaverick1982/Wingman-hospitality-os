"use client";

import { useState, useTransition } from "react";
import { sendBillingSetupEmail, setOrgBillingMode, resetOrgBilling } from "../actions";
import { billingBadge } from "@/lib/billing-label";

export function BillingCard({
  orgId,
  isFree,
  billingStatus,
  cardBrand,
  cardLast4,
}: {
  orgId: string;
  isFree: boolean;
  billingStatus: string;
  cardBrand: string | null;
  cardLast4: string | null;
}) {
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
    </div>
  );
}
