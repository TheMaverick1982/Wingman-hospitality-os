"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { affiliateLogin, affiliateForgotPassword, type AffiliateLoginState, type AffiliateForgotState } from "../actions";

const loginInitial: AffiliateLoginState = { error: null };
const forgotInitial: AffiliateForgotState = { error: null, sent: false };
const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors";

export function AffiliateLoginForm() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [loginState, loginAction, loginPending] = useActionState(affiliateLogin, loginInitial);
  const [forgotState, forgotAction, forgotPending] = useActionState(affiliateForgotPassword, forgotInitial);

  if (mode === "forgot") {
    if (forgotState.sent) {
      return (
        <div className="text-center">
          <h2 className="text-lg font-bold text-ink mb-2">Check your email</h2>
          <p className="text-[14px] text-muted leading-relaxed mb-5">
            If an account exists for that email, we&apos;ve sent a link to reset your password. Open it and choose a new
            one — you&apos;ll land back on your affiliate dashboard.
          </p>
          <button type="button" onClick={() => setMode("login")} className="text-[14px] font-semibold text-brick hover:opacity-70">
            Back to log in
          </button>
        </div>
      );
    }
    return (
      <form action={forgotAction} className="flex flex-col gap-4">
        <div>
          <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
          <input name="email" type="email" required placeholder="you@example.com" className={field} />
        </div>
        {forgotState.error && <p className="text-sm text-danger">{forgotState.error}</p>}
        <button
          type="submit"
          disabled={forgotPending}
          className="text-[16px] font-semibold text-white bg-brick rounded-full px-7 py-3.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
        >
          {forgotPending ? "Sending…" : "Send reset link"}
        </button>
        <button type="button" onClick={() => setMode("login")} className="text-center text-[13px] font-semibold text-muted hover:text-ink">
          Back to log in
        </button>
      </form>
    );
  }

  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
        <input name="email" type="email" required placeholder="you@example.com" className={field} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[13px] font-semibold text-ink">Password</label>
          <button type="button" onClick={() => setMode("forgot")} className="text-[12.5px] font-semibold text-brick hover:opacity-70">
            Forgot password?
          </button>
        </div>
        <input name="password" type="password" required placeholder="Your password" className={field} />
      </div>
      {loginState.error && <p className="text-sm text-danger">{loginState.error}</p>}
      <button
        type="submit"
        disabled={loginPending}
        className="text-[16px] font-semibold text-white bg-brick rounded-full px-7 py-3.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
      >
        {loginPending ? "Signing in…" : "Log in"}
      </button>
      <p className="text-center text-[13px] text-muted-2">
        New here?{" "}
        <Link href="/affiliates#apply" className="font-semibold text-brick hover:opacity-70">
          Apply to become an affiliate
        </Link>
      </p>
    </form>
  );
}
