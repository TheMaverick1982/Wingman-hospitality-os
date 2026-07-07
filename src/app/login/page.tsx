"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-display text-2xl font-semibold mb-6 text-ink">Log in to Wingman</h1>
      <GoogleSignInButton />
      <div className="flex items-center gap-3 my-5">
        <div className="h-px bg-line flex-1" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px bg-line flex-1" />
      </div>
      <form action={formAction} className="flex flex-col gap-1">
        <Field label="Email">
          <input name="email" type="email" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required className={inputClass} />
        </Field>
        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
          {pending ? "Logging in..." : "Log in"}
        </Btn>
      </form>
      <p className="text-sm text-muted mt-4">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-brick">
          Set up your organization
        </Link>
      </p>
    </div>
  );
}
