"use client";

import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { addGrowthEntry, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function ActualsForm({ locationId, frequency }: { locationId: string | null; frequency: "weekly" | "monthly" }) {
  const [state, formAction, pending] = useActionState(addGrowthEntry, initialState);
  const [periodDate, setPeriodDate] = useState(todayIso());

  const quickPicks =
    frequency === "weekly"
      ? [
          { label: "This week", value: todayIso() },
          { label: "Last week", value: daysAgoIso(7) },
          { label: "2 weeks ago", value: daysAgoIso(14) },
        ]
      : [
          { label: "This month", value: todayIso() },
          { label: "Last month", value: monthsAgoIso(1) },
          { label: "2 months ago", value: monthsAgoIso(2) },
        ];

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <input type="hidden" name="locationId" value={locationId ?? ""} />
      <div className="mb-5">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Log this {frequency === "weekly" ? "week's" : "month's"} numbers</div>
        <div className="text-[13px] text-muted mt-0.5">
          Logging the same date again updates that period instead of creating a duplicate.
        </div>
      </div>

      <Field label="Period date">
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          {quickPicks.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setPeriodDate(q.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                periodDate === q.value ? "bg-brick text-white" : "text-brick bg-brick-tint hover:opacity-80"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          name="periodDate"
          value={periodDate}
          onChange={(e) => setPeriodDate(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6">
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
