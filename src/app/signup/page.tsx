"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = { error: null, checkEmail: false };

const POINTS = [
  "A culture statement and five core values, written in your voice",
  "Role-based training and sign-offs for every position",
  "Daily checklists, spot-checks, and guest retention tracking",
];

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <div className="min-h-full flex flex-col bg-white">
      <div className="max-w-[1180px] w-full mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] rounded-lg bg-ink flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">W</span>
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Wingman</span>
        </Link>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brick">
            Log in
          </Link>
        </p>
      </div>

      {state.checkEmail ? (
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-[420px] text-center">
            <h1 className="font-display text-3xl font-bold text-ink mb-3">Check your email</h1>
            <p className="text-[17px] text-muted">
              We sent you a confirmation link. Click it to activate your account and set up your
              organization.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 max-w-[1180px] w-full mx-auto px-6 sm:px-10 pt-6 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-11 lg:gap-[88px] items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
              <span className="w-[7px] h-[7px] rounded-full bg-brick" />
              <span className="text-[13px] font-semibold text-brick-dark">Live on your first shift</span>
            </div>
            <h1 className="font-display text-4xl sm:text-[56px] leading-[1.04] tracking-[-0.03em] font-bold text-ink mb-6">
              Set your standard in minutes.
            </h1>
            <p className="text-lg sm:text-xl text-muted leading-[1.5] max-w-[460px] mb-10">
              Answer a few questions about your restaurant and Wingman builds your culture,
              training, and accountability system around it.
            </p>
            <div className="flex flex-col gap-[18px]">
              {POINTS.map((p) => (
                <div key={p} className="flex gap-3.5 items-start">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-brick-tint text-brick flex items-center justify-center text-[13px] mt-px">
                    ✓
                  </span>
                  <span className="text-[17px] text-ink leading-[1.45]">{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-paper rounded-[28px] p-8 sm:p-11">
            <h2 className="text-2xl font-semibold tracking-[-0.015em] text-ink mb-1">
              Create your workspace
            </h2>
            <p className="text-[15px] text-muted mb-7">No credit card required.</p>

            <form action={formAction} className="flex flex-col gap-1">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Your name">
                  <input name="fullName" placeholder="Nadia K." required className={inputClass} />
                </Field>
                <Field label="Restaurant name">
                  <input name="orgName" placeholder="Downtown Flagship" required className={inputClass} />
                </Field>
              </div>
              <Field label="Your first location">
                <input name="locationName" placeholder="Delray Beach" required className={inputClass} />
              </Field>
              <Field label="Work email">
                <input name="email" type="email" placeholder="you@restaurant.com" required className={inputClass} />
              </Field>
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                  className={inputClass}
                />
              </Field>
              {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
              <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
                {pending ? "Creating..." : "Create workspace"}
              </Btn>
            </form>

            <div className="flex items-center gap-3.5 my-6">
              <div className="h-px bg-line-strong flex-1" />
              <span className="text-[13px] text-muted-2">or</span>
              <div className="h-px bg-line-strong flex-1" />
            </div>

            <GoogleSignInButton />

            <p className="text-[13px] text-muted-2 leading-[1.5] text-center mt-[18px]">
              By creating an account you agree to Wingman&apos;s Terms and Privacy Policy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
