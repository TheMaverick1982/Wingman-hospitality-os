"use client";

import { useActionState, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { updateCultureText, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function CultureTextForm({
  field,
  initialValue,
  placeholder,
  accent = "gold",
}: {
  field: "x_factor" | "weekly_experiment";
  initialValue: string;
  placeholder?: string;
  accent?: "gold" | "ink";
}) {
  const [state, formAction, pending] = useActionState(updateCultureText, initialState);
  const [value, setValue] = useState(initialValue);
  const border = accent === "gold" ? "border-[#ffcc80]" : "border-line";

  return (
    <form action={formAction}>
      <input type="hidden" name="field" value={field} />
      <textarea
        name="value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className={`w-full rounded-lg p-3 text-sm bg-panel border ${border} text-ink`}
      />
      <div className="flex items-center justify-end mt-2">
        <Btn small type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Btn>
      </div>
      {state.error && <p className="text-sm text-brick mt-1">{state.error}</p>}
    </form>
  );
}
