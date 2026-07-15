"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="min-h-full flex flex-col force-light bg-panel" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
      <div className="max-w-[1180px] w-full mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <WingmanLogo className="h-6 w-auto" />
        </Link>
        <p className="text-sm text-muted">
          New to Wingman?{" "}
          <Link href="/signup" className="font-semibold text-brick">
            Get Started
          </Link>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-bold text-ink mb-3">
              Welcome back
            </h1>
            <p className="text-[17px] text-muted">Log in to your Wingman workspace.</p>
          </div>

          <div className="bg-white border border-line rounded-3xl p-8 sm:p-9 shadow-md">
            <form action={formAction} className="flex flex-col gap-1">
              <Field label="Work email">
                <input name="email" type="email" placeholder="you@restaurant.com" required className={inputClass} />
              </Field>
              <Field label="Password">
                <input name="password" type="password" placeholder="••••••••" required className={inputClass} />
              </Field>
              <div className="flex justify-end -mt-1 mb-1">
                <Link href="/forgot-password" className="text-sm font-medium text-brick">
                  Forgot password?
                </Link>
              </div>
              <div className="mt-1">
                <TurnstileWidget />
              </div>
              {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
              <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
                {pending ? "Logging in..." : "Log in"}
              </Btn>
            </form>

            <div className="flex items-center gap-3.5 my-6">
              <div className="h-px bg-line flex-1" />
              <span className="text-[13px] text-muted-2">or</span>
              <div className="h-px bg-line flex-1" />
            </div>

            <GoogleSignInButton />
          </div>

          <p className="text-center text-sm text-muted mt-6">
            Just want to look around?{" "}
            <Link href="/demo" className="font-semibold text-brick">
              Try the live demo →
            </Link>
          </p>

          <p className="text-center text-sm text-muted mt-7">
            New to Wingman?{" "}
            <Link href="/signup" className="font-semibold text-brick">
              Get Started →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
