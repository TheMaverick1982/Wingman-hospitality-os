"use client";

import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Btn } from "@/components/ui/btn";
import { saveGrowthPlan, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

const PRESETS = [
  { label: "Conservative — 20/20/20", customers: 20, avgSale: 20, frequency: 20 },
  { label: "Aggressive — 33/25/50", customers: 33, avgSale: 25, frequency: 50 },
];

export function GrowthPlanForm({
  locationId,
  locationLabel,
  initial,
}: {
  locationId: string | null;
  locationLabel: string;
  initial: {
    frequency: "weekly" | "monthly";
    currentCustomers: number;
    currentAvgSale: number;
    currentRepurchaseFrequency: number;
    targetCustomersPct: number;
    targetAvgSalePct: number;
    targetFrequencyPct: number;
  };
}) {
  const [state, formAction, pending] = useActionState(saveGrowthPlan, initialState);
  const [target, setTarget] = useState({
    customers: initial.targetCustomersPct,
    avgSale: initial.targetAvgSalePct,
    frequency: initial.targetFrequencyPct,
  });

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-7 shadow-sm">
      <input type="hidden" name="locationId" value={locationId ?? ""} />
      <div className="mb-6">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Your numbers — {locationLabel}</div>
        <div className="text-[13px] text-muted mt-0.5">Enter your current baseline, then set a growth target.</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <Field label="Track by">
          <select name="frequency" defaultValue={initial.frequency} className={inputClass}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <div className="hidden sm:block" />
        <Field label="Current # of customers">
          <input type="number" name="currentCustomers" min="0" step="1" defaultValue={initial.currentCustomers || ""} className={inputClass} />
        </Field>
        <Field label="Current average $ per sale">
          <input type="number" name="currentAvgSale" min="0" step="0.01" defaultValue={initial.currentAvgSale || ""} className={inputClass} />
        </Field>
        <Field label="Current repurchase frequency">
          <input type="number" name="currentRepurchaseFrequency" min="0" step="0.01" defaultValue={initial.currentRepurchaseFrequency || ""} className={inputClass} />
        </Field>
      </div>

      <div className="mt-2 mb-4">
        <div className="text-[13px] font-semibold text-ink mb-2">Target plan</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setTarget({ customers: p.customers, avgSale: p.avgSale, frequency: p.frequency })}
              className="text-xs font-semibold text-brick bg-brick-tint px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6">
          <Field label="Increase # of customers by %">
            <input
              type="number"
              name="targetCustomersPct"
              step="1"
              value={target.customers}
              onChange={(e) => setTarget((t) => ({ ...t, customers: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="Increase avg $ per sale by %">
            <input
              type="number"
              name="targetAvgSalePct"
              step="1"
              value={target.avgSale}
              onChange={(e) => setTarget((t) => ({ ...t, avgSale: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="Increase repurchase frequency by %">
            <input
              type="number"
              name="targetFrequencyPct"
              step="1"
              value={target.frequency}
              onChange={(e) => setTarget((t) => ({ ...t, frequency: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
      <div className="flex justify-end">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save plan"}
        </Btn>
      </div>
    </form>
  );
}
