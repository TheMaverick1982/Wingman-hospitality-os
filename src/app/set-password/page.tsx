"use client";

import { useActionState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { setPassword, type SetPasswordState } from "./actions";

const initialState: SetPasswordState = { error: null };

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-display text-2xl font-semibold mb-1 text-ink">Set your password</h1>
      <p className="text-sm text-muted mb-6">You&apos;ve been added to a Wingman team. Choose a password to finish setting up your account.</p>
      <form action={formAction} className="flex flex-col gap-1">
        <Field label="Password">
          <input name="password" type="password" placeholder="At least 8 characters" required className={inputClass} />
        </Field>
        <Field label="Confirm password">
          <input name="confirm" type="password" required className={inputClass} />
        </Field>
        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
          {pending ? "Saving..." : "Set password & continue"}
        </Btn>
      </form>
    </div>
  );
}
