"use client";

import { useActionState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { updateGaMeasurementId, type AnalyticsSettingsState } from "./actions";

const initialState: AnalyticsSettingsState = { error: null, success: false };

export function GaSettingsForm({ currentValue }: { currentValue: string | null }) {
  const [state, formAction, pending] = useActionState(updateGaMeasurementId, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1 max-w-sm">
      <Field label="GA4 Measurement ID">
        <input
          name="gaMeasurementId"
          placeholder="G-XXXXXXXXXX"
          defaultValue={currentValue ?? ""}
          className={inputClass}
        />
      </Field>
      {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
      {state.success && <p className="text-sm text-[#15803D] mb-2">Saved. It&apos;ll load on the next page view.</p>}
      <Btn type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? "Saving..." : "Save"}
      </Btn>
    </form>
  );
}
