"use client";

import { useActionState } from "react";
import { Btn } from "@/components/ui/btn";
import { Field, inputClass } from "@/components/ui/field";
import { HoneypotField } from "@/components/honeypot-field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { startDemoSandbox, type DemoStartState } from "@/app/demo/actions";

const initialState: DemoStartState = { error: null };

export function LaunchDemoForm() {
  const [state, formAction, pending] = useActionState(startDemoSandbox, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 text-left">
      <HoneypotField />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Work email">
          <input name="email" type="email" required placeholder="you@restaurant.com" className={inputClass} />
        </Field>
        <Field label="Name">
          <input name="name" type="text" required placeholder="Nadia K." className={inputClass} />
        </Field>
      </div>

      <Btn type="submit" loading={pending} disabled={pending} className="w-full justify-center py-3.5 text-[17px] mt-1">
        {pending ? "Building your demo…" : "Launch my demo →"}
      </Btn>
      <p className="text-[13px] text-muted-2 text-center">No signup needed. Ready in a few seconds.</p>

      <div className="flex justify-center">
        <TurnstileWidget />
      </div>
      {state.error && <p className="text-sm text-danger text-center">{state.error}</p>}
    </form>
  );
}
