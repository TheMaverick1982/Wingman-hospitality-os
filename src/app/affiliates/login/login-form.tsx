"use client";

import { useActionState } from "react";
import Link from "next/link";
import { affiliateLogin, type AffiliateLoginState } from "../actions";

const initial: AffiliateLoginState = { error: null };
const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors";

export function AffiliateLoginForm() {
  const [state, action, pending] = useActionState(affiliateLogin, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
        <input name="email" type="email" required placeholder="you@example.com" className={field} />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">Password</label>
        <input name="password" type="password" required placeholder="Your password" className={field} />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="text-[16px] font-semibold text-white bg-brick rounded-full px-7 py-3.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Log in"}
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
