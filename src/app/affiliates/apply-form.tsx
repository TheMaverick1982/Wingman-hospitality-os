"use client";

import { useActionState } from "react";
import Link from "next/link";
import { HoneypotField } from "@/components/honeypot-field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { applyAsAffiliate, type ApplyState } from "./actions";

const initial: ApplyState = { error: null, ok: false };

const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors";

export function AffiliateApplyForm() {
  const [state, action, pending] = useActionState(applyAsAffiliate, initial);

  if (state.ok && state.message) {
    return (
      <div className="bg-white border border-line rounded-[22px] p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-olive-tint text-olive flex items-center justify-center mx-auto mb-4 text-xl">✓</div>
        <h3 className="text-xl font-bold text-ink mb-2">Application received</h3>
        <p className="text-[15px] text-muted leading-relaxed mb-5">{state.message}</p>
        <Link href="/affiliates/login" className="text-[15px] font-semibold text-brick hover:opacity-70">
          Go to affiliate login →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white border border-line rounded-[22px] p-6 sm:p-8 shadow-sm flex flex-col gap-4">
      <HoneypotField />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-semibold text-ink mb-1.5">Your name</label>
          <input name="fullName" required placeholder="Alex Rivera" className={field} />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
          <input name="email" type="email" required placeholder="alex@example.com" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-semibold text-ink mb-1.5">Create a password</label>
          <input name="password" type="password" required minLength={8} placeholder="At least 8 characters" className={field} />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-ink mb-1.5">
            PayPal email <span className="font-normal text-muted-2">(for payouts — optional now)</span>
          </label>
          <input name="paypalEmail" type="email" placeholder="Where we send commissions" className={field} />
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">How will you promote Wingman?</label>
        <textarea name="promo" rows={3} placeholder="Your audience, channels, or how you know restaurant operators…" className={`${field} resize-y`} />
      </div>

      <label className="flex items-start gap-2.5 text-[13px] text-muted leading-relaxed">
        <input type="checkbox" name="agree" className="mt-0.5 accent-brick" />
        <span>
          I agree to the{" "}
          <Link href="/affiliates/terms" target="_blank" className="font-semibold text-brick hover:opacity-70">
            Affiliate Agreement
          </Link>{" "}
          — no spam, no self-referrals, and no bidding on Wingman-branded search terms.
        </span>
      </label>

      <TurnstileWidget />

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 text-[16px] font-semibold text-white bg-brick rounded-full px-7 py-3.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Apply to become an affiliate"}
      </button>
      <p className="text-center text-[13px] text-muted-2">
        Already an affiliate?{" "}
        <Link href="/affiliates/login" className="font-semibold text-brick hover:opacity-70">
          Log in
        </Link>
      </p>
    </form>
  );
}
