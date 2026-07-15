"use client";

import { useActionState, useState, useTransition } from "react";
import { CreditCard, Check, Loader2, Beaker, Trash2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { saveTestCard, chargeNow, removeBillingCard } from "./global-payments-actions";

export type BillingCardInfo = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } | null;
export type TestCard = { brand: string; number: string; exp: string; cvv: string };

const saveInitial = { error: null as string | null, ok: false };

// The card-on-file manager inside the Billing tab, backed by Global Payments.
// In the sandbox it offers a test-card path so the whole store→charge→receipt
// loop can be proven before a live card is ever involved (mirrors the Square
// sandbox-token validation pattern). Card numbers never touch our database —
// only the processor's stored token does.
export function GlobalPaymentsCard({
  configured,
  isSandbox,
  card,
  testCards,
}: {
  configured: boolean;
  isSandbox: boolean;
  card: BillingCardInfo;
  testCards: TestCard[];
}) {
  const [selected, setSelected] = useState(0);
  const [saveState, saveAction, saving] = useActionState(saveTestCard, saveInitial);
  const [charging, startCharge] = useTransition();
  const [removing, startRemove] = useTransition();
  const [chargeMsg, setChargeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onFile = card?.last4 ? `${card.brand ?? "Card"} •••• ${card.last4}` : null;

  if (!configured) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <CreditCard size={16} className="text-muted" />
        <span className="text-xs text-muted-2">
          Payment processing is being set up — secure card management will appear here soon.
        </span>
      </div>
    );
  }

  const t = testCards[selected] ?? testCards[0];

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={16} className={onFile ? "text-ink" : "text-muted"} />
        <span className={onFile ? "text-sm text-ink" : "text-sm text-muted"}>{onFile ?? "No payment method on file"}</span>
        {onFile && (
          <button
            type="button"
            onClick={() => startRemove(async () => { await removeBillingCard(); })}
            disabled={removing}
            className="ml-1 inline-flex items-center gap-1 text-[12px] font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
          >
            <Trash2 size={12} /> {removing ? "Removing…" : "Remove"}
          </button>
        )}
      </div>

      {onFile && (
        <div className="mb-4">
          <button
            type="button"
            disabled={charging}
            onClick={() =>
              startCharge(async () => {
                setChargeMsg(null);
                const r = await chargeNow();
                if (r.error) setChargeMsg({ ok: false, text: r.error });
                else setChargeMsg({ ok: true, text: `Charged${r.amountCents ? ` $${(r.amountCents / 100).toFixed(2)}` : ""} — receipt sent. Account marked active.` });
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-brick text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {charging ? <Loader2 size={14} className="animate-spin" /> : null}
            {charging ? "Charging…" : isSandbox ? "Run a test charge" : "Charge now"}
          </button>
          {chargeMsg && (
            <p className={`text-[13px] mt-2 ${chargeMsg.ok ? "text-olive" : "text-danger"}`}>{chargeMsg.text}</p>
          )}
        </div>
      )}

      {isSandbox ? (
        <div className="rounded-xl border border-dashed border-line bg-canvas/40 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Beaker size={14} className="text-olive" />
            <span className="text-[13px] font-semibold text-ink">Sandbox — add a test card</span>
          </div>
          <p className="text-[12.5px] text-muted-2 mb-3">
            Store one of Global Payments&apos; published test cards to validate billing end-to-end. No real money moves.
            Live card entry uses secure hosted fields and goes live with your production account.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {testCards.map((c, i) => (
              <button
                key={c.number}
                type="button"
                onClick={() => setSelected(i)}
                className={`text-[12px] font-semibold rounded-full px-3 py-1 border transition-colors ${
                  i === selected ? "border-brick text-brick bg-brick-tint" : "border-line text-muted-2 hover:border-brick"
                }`}
              >
                {c.brand}
              </button>
            ))}
          </div>
          <form action={saveAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="number" value={t.number} />
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1">Card</label>
              <input readOnly value={t.number} className={`${inputClass} w-48 font-mono text-[13px]`} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1">Exp</label>
              <input name="exp" defaultValue={t.exp} className={`${inputClass} w-20`} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink mb-1">CVV</label>
              <input name="cvv" defaultValue={t.cvv} className={`${inputClass} w-20`} />
            </div>
            <Btn type="submit" disabled={saving}>
              {saving ? "Saving…" : onFile ? "Replace card" : "Save card"}
            </Btn>
          </form>
          {saveState.error && <p className="text-[13px] text-danger mt-2">{saveState.error}</p>}
          {saveState.ok && (
            <p className="text-[13px] text-olive mt-2 inline-flex items-center gap-1">
              <Check size={13} /> Test card saved as your card on file.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-2">
          Enter your card securely below — powered by Global Payments. Your card details go straight to the processor and
          never touch our servers.
        </p>
      )}
    </div>
  );
}
