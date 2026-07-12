"use client";

import { useActionState, useState } from "react";
import { createCoupon, type CouponFormState } from "./actions";

const initial: CouponFormState = { error: null, ok: false };

export function CouponForm() {
  const [state, action, pending] = useActionState(createCoupon, initial);
  const [kind, setKind] = useState<"one_time" | "recurring" | "trial">("one_time");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [duration, setDuration] = useState<"forever" | "months">("forever");

  const isTrial = kind === "trial";

  const field = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick";
  const label = "text-[13px] font-semibold text-charcoal-2 block mb-1.5";

  return (
    <form action={action} className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div className="text-[15px] font-semibold text-ink">New coupon</div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[160px]">
          <label className={label}>Code</label>
          <input name="code" required placeholder="LAUNCH20" className={`${field} font-mono uppercase`} />
        </div>
        <div className="flex-[2] min-w-[200px]">
          <label className={label}>Description (internal)</label>
          <input name="description" placeholder="Launch promo — 20% off first 3 months" className={field} />
        </div>
      </div>

      {/* Type */}
      <div>
        <label className={label}>Type</label>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "one_time", label: "One-time discount" },
            { key: "recurring", label: "Recurring discount" },
            { key: "trial", label: "Free trial" },
          ].map((t) => (
            <label
              key={t.key}
              className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border cursor-pointer transition-colors ${
                kind === t.key ? "bg-ink text-white border-ink" : "text-charcoal-2 border-line hover:border-brick"
              }`}
            >
              <input type="radio" name="kind" value={t.key} checked={kind === t.key} onChange={() => setKind(t.key as typeof kind)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* Trial length */}
      {isTrial ? (
        <div className="max-w-[220px]">
          <label className={label}>Trial length (days)</label>
          <input name="trial_days" type="number" min={1} max={365} defaultValue={14} className={field} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className={label}>Discount</label>
              <div className="flex gap-1.5">
                {[
                  { key: "percent", label: "% off" },
                  { key: "amount", label: "$ off" },
                ].map((d) => (
                  <label
                    key={d.key}
                    className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border cursor-pointer transition-colors ${
                      discountType === d.key ? "bg-ink text-white border-ink" : "text-charcoal-2 border-line hover:border-brick"
                    }`}
                  >
                    <input type="radio" name="discount_type" value={d.key} checked={discountType === d.key} onChange={() => setDiscountType(d.key as typeof discountType)} className="sr-only" />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            {discountType === "percent" ? (
              <div className="max-w-[140px]">
                <label className={label}>Percent off</label>
                <input name="percent_off" type="number" min={1} max={100} defaultValue={20} className={field} />
              </div>
            ) : (
              <div className="max-w-[160px]">
                <label className={label}>Dollars off</label>
                <input name="amount_off" type="number" min={1} step="0.01" defaultValue={50} className={field} />
              </div>
            )}
          </div>

          {kind === "recurring" && (
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className={label}>Applies for</label>
                <div className="flex gap-1.5">
                  {[
                    { key: "forever", label: "Every charge" },
                    { key: "months", label: "N months" },
                  ].map((d) => (
                    <label
                      key={d.key}
                      className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border cursor-pointer transition-colors ${
                        duration === d.key ? "bg-ink text-white border-ink" : "text-charcoal-2 border-line hover:border-brick"
                      }`}
                    >
                      <input type="radio" name="duration" value={d.key} checked={duration === d.key} onChange={() => setDuration(d.key as typeof duration)} className="sr-only" />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              {duration === "months" && (
                <div className="max-w-[140px]">
                  <label className={label}>Months</label>
                  <input name="duration_months" type="number" min={1} defaultValue={3} className={field} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Limits */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[160px]">
          <label className={label}>Max redemptions (optional)</label>
          <input name="max_redemptions" type="number" min={1} placeholder="Unlimited" className={field} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className={label}>Expires (optional)</label>
          <input name="expires_at" type="date" className={field} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50">
          {pending ? "Creating…" : "Create coupon"}
        </button>
        {state.ok && <span className="text-[14px] text-olive font-semibold">Coupon created ✓</span>}
        {state.error && <span className="text-[14px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
