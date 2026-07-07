"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = { error: null, checkEmail: false };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.checkEmail) {
    return (
      <div className="mx-auto max-w-sm py-24 text-center">
        <h1 className="font-display text-2xl font-semibold mb-2 text-ink">Check your email</h1>
        <p className="text-sm text-muted">
          We sent you a confirmation link. Click it to activate your account and set up your
          organization.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-display text-2xl font-semibold mb-1 text-ink">Set up Wingman</h1>
      <p className="text-sm text-muted mb-6">
        You&apos;ll be the Super Admin for your organization — you can invite your team afterward.
      </p>
      <GoogleSignInButton />
      <div className="flex items-center gap-3 my-5">
        <div className="h-px bg-line flex-1" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px bg-line flex-1" />
      </div>
      <form action={formAction} className="flex flex-col gap-1">
        <Field label="Restaurant / organization name">
          <input name="orgName" placeholder="Square Peg" required className={inputClass} />
        </Field>
        <Field label="Your first location">
          <input name="locationName" placeholder="Delray Beach" required className={inputClass} />
        </Field>
        <Field label="Your name">
          <input name="fullName" placeholder="Jane Doe" required className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" placeholder="you@example.com" required className={inputClass} />
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
          {pending ? "Creating..." : "Create organization"}
        </Btn>
      </form>
      <p className="text-sm text-muted mt-4">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brick">
          Log in
        </Link>
      </p>
    </div>
  );
}
