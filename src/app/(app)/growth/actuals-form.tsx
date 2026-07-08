"use client";

import { useActionState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { addGrowthEntry, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ActualsForm({ locationId, frequency }: { locationId: string | null; frequency: "weekly" | "monthly" }) {
  const [state, formAction, pending] = useActionState(addGrowthEntry, initialState);

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <input type="hidden" name="locationId" value={locationId ?? ""} />
      <div className="mb-5">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Log this {frequency === "weekly" ? "week's" : "month's"} numbers</div>
        <div className="text-[13px] text-muted mt-0.5">
          Logging the same date again updates that period instead of creating a duplicate.
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-6">
        <Field label="Period date">
          <input type="date" name="periodDate" defaultValue={todayIso()} className={inputClass} />
        </Field>
        <Field label="# of customers">
          <input type="number" name="customers" min="0" step="1" className={inputClass} />
        </Field>
        <Field label="Average $ per sale">
          <input type="number" name="avgSale" min="0" step="0.01" className={inputClass} />
        </Field>
        <Field label="Repurchase frequency">
          <input type="number" name="repurchaseFrequency" min="0" step="0.01" className={inputClass} />
        </Field>
      </div>
      {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
      <div className="flex justify-end">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving..." : "Log entry"}
        </Btn>
      </div>
    </form>
  );
}
