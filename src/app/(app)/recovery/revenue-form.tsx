"use client";

import { useActionState } from "react";
import { updateTotalRevenue, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function RevenueForm({ initialValue }: { initialValue: number }) {
  const [state, formAction, pending] = useActionState(updateTotalRevenue, initialState);

  return (
    <div className="bg-panel border border-line rounded-2xl p-5 flex-1 min-w-[200px]">
      <label className="text-xs uppercase tracking-wide font-semibold block mb-2 text-muted">
        Total revenue this period
      </label>
      <form action={formAction} className="flex items-center gap-2">
        <input
          type="number"
          name="totalRevenue"
          step="0.01"
          defaultValue={initialValue}
          className="w-full rounded px-2 py-1.5 text-lg font-semibold font-mono border border-line text-ink"
        />
        <button type="submit" disabled={pending} className="text-xs font-semibold text-brick disabled:opacity-50">
          {pending ? "..." : "Save"}
        </button>
      </form>
      {state.error && <p className="text-xs text-brick mt-1">{state.error}</p>}
    </div>
  );
}
