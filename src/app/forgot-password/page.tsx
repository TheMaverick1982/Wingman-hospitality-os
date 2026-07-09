"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null, sent: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div
      className="min-h-full flex flex-col force-light bg-panel"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}
    >
      <div className="max-w-[1180px] w-full mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <WingmanLogo className="h-6 w-auto" />
        </Link>
        <p className="text-sm text-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-brick">
            Log in
          </Link>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-[420px]">
          {state.sent ? (
            <div className="bg-white border border-line rounded-3xl p-8 sm:p-9 shadow-md text-center">
              <h1 className="font-display text-3xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-3">
                Check your email
              </h1>
              <p className="text-[15px] leading-[1.55] text-muted">
                If an account exists for that email, we&apos;ve sent a link to reset your password.
                Open it and choose a new password. The link expires shortly, so use it soon.
              </p>
              <Link href="/login" className="inline-block mt-7 font-semibold text-brick text-sm">
                Back to log in →
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                <h1 className="font-display text-4xl sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-bold text-ink mb-3">
                  Reset your password
                </h1>
                <p className="text-[17px] text-muted">
                  Enter your work email and we&apos;ll send you a reset link.
                </p>
              </div>

              <div className="bg-white border border-line rounded-3xl p-8 sm:p-9 shadow-md">
                <form action={formAction} className="flex flex-col gap-1">
                  <Field label="Work email">
                    <input
                      name="email"
                      type="email"
                      placeholder="you@restaurant.com"
                      required
                      className={inputClass}
                    />
                  </Field>
                  {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
                  <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
                    {pending ? "Sending..." : "Send reset link"}
                  </Btn>
                </form>
              </div>

              <p className="text-center text-sm text-muted mt-7">
                Remembered it?{" "}
                <Link href="/login" className="font-semibold text-brick">
                  Log in →
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
