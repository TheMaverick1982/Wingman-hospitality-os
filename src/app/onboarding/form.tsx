"use client";

import { useActionState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { completeOnboarding, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Field label="Restaurant / organization name">
        <input name="orgName" required className={inputClass} />
      </Field>
      <Field label="Your first location">
        <input name="locationName" required className={inputClass} />
      </Field>
      <Field label="Your name">
        <input name="fullName" required className={inputClass} />
      </Field>
      {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
      <Btn type="submit" disabled={pending} className="w-full justify-center mt-1">
        {pending ? "Creating..." : "Create organization"}
      </Btn>
    </form>
  );
}
