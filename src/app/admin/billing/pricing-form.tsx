"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { savePlatformPricing, type PricingFormState } from "./pricing-actions";

const initial: PricingFormState = { error: null };

export function PricingForm({ firstDollars, addlDollars }: { firstDollars: number; addlDollars: number }) {
  const [state, action, pending] = useActionState(savePlatformPricing, initial);

  return (
    <form action={action} className="flex flex-col gap-4 max-w-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[13px] font-semibold text-ink block mb-1.5">First location / mo</label>
          <div className="flex items-center gap-1.5">
            <span className="text-muted">$</span>
            <input name="first" type="number" min={1} defaultValue={firstDollars} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
          </div>
        </div>
        <div>
          <label className="text-[13px] font-semibold text-ink block mb-1.5">Each additional / mo</label>
          <div className="flex items-center gap-1.5">
            <span className="text-muted">$</span>
            <input name="addl" type="number" min={0} defaultValue={addlDollars} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brick" />
          </div>
        </div>
      </div>
      <p className="text-[12.5px] text-muted-2">This updates the price everywhere it shows — the pricing page, calculator, billing, help, and sales materials.</p>
      <div className="rounded-xl bg-olive/5 border border-olive/20 px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-charcoal-2">
          <span className="font-semibold text-ink">Existing customers are protected.</span> Changing these rates only
          affects <span className="font-semibold text-ink">new signups</span> from here on. Every current organization
          is locked to the price it signed up at, so no one already paying you gets re-priced.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50">
          {pending ? "Saving…" : "Save pricing"}
        </button>
        {state.ok && <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-olive"><Check size={14} /> Saved</span>}
        {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
