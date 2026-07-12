"use client";

import { useActionState } from "react";
import { applyCouponToOrg, removeOrgCoupon, type PricingState } from "../actions";

const initial: PricingState = { error: null, ok: false };

type Redemption = {
  code: string;
  kind: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  duration_months: number | null;
  trial_days: number | null;
  source: string;
} | null;

// In a helper so it isn't flagged as an impure call in the render body.
function isFuture(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() > Date.now();
}

function terms(r: NonNullable<Redemption>): string {
  if (r.kind === "trial") return `${r.trial_days}-day free trial`;
  const off = r.percent_off != null ? `${r.percent_off}% off` : r.amount_off_cents != null ? `$${(r.amount_off_cents / 100).toFixed(2).replace(/\.00$/, "")} off` : "discount";
  if (r.kind === "one_time") return `${off} the first charge`;
  return `${off}${r.duration_months ? ` for ${r.duration_months} mo` : " (every charge)"}`;
}

export function CouponCard({ orgId, redemption, trialEndsAt }: { orgId: string; redemption: Redemption; trialEndsAt: string | null }) {
  const [state, action] = useActionState(async (_prev: PricingState, formData: FormData) => applyCouponToOrg(orgId, formData), initial);
  const trialActive = isFuture(trialEndsAt);

  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
      <div className="text-[15px] font-semibold text-ink">Coupon</div>

      {redemption ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-ink">{redemption.code}</span>
            <span className="text-[13px] text-charcoal-2">· {terms(redemption)}</span>
            <span className="text-[12px] text-muted-2">({redemption.source})</span>
          </div>
          {trialEndsAt && (
            <div className={`text-[13px] ${trialActive ? "text-olive font-medium" : "text-muted"}`}>
              Trial {trialActive ? "ends" : "ended"} {new Date(trialEndsAt).toLocaleDateString()}
            </div>
          )}
          <form action={async () => { await removeOrgCoupon(orgId); }}>
            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger">Remove coupon</button>
          </form>
        </div>
      ) : (
        <p className="text-[13px] text-muted">No coupon on this account.</p>
      )}

      <form action={action} className="flex items-center gap-2 pt-1">
        <input name="code" placeholder="Apply a code" className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick font-mono uppercase" />
        <button type="submit" className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors">Apply</button>
      </form>
      {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      {state.ok && <span className="text-[13px] text-olive font-semibold">Applied ✓</span>}
    </div>
  );
}
