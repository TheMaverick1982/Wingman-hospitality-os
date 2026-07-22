"use client";

import { use, useActionState } from "react";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Btn } from "@/components/ui/btn";
import { setPassword, type SetPasswordState } from "./actions";

const initialState: SetPasswordState = { error: null };

export default function SetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = use(searchParams);
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-display text-2xl font-semibold mb-1 text-ink">Set your password</h1>
      <p className="text-sm text-muted mb-6">Choose a password for your Wingman account.</p>
      <form action={formAction} className="flex flex-col gap-1">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Password">
          <PasswordInput name="password" placeholder="At least 8 characters" required />
        </Field>
        <Field label="Confirm password">
          <PasswordInput name="confirm" required />
        </Field>
        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
          {pending ? "Saving..." : "Set password & continue"}
        </Btn>
      </form>
    </div>
  );
}
