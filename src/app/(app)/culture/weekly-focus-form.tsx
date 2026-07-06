"use client";

import { useActionState, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { updateWeeklyFocus, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function WeeklyFocusForm({ initialValue }: { initialValue: string }) {
  const [state, formAction, pending] = useActionState(updateWeeklyFocus, initialState);
  const [value, setValue] = useState(initialValue);

  return (
    <form action={formAction}>
      <textarea
        name="weeklyFocus"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full rounded-lg p-3 text-sm bg-white border border-[#ffcc80] text-ink"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-[#92400e]">Read this at the start of every shift, every location, this week.</p>
        <Btn small type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Btn>
      </div>
      {state.error && <p className="text-sm text-brick mt-1">{state.error}</p>}
    </form>
  );
}
