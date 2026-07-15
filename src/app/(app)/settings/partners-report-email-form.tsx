"use client";

import { useActionState, useEffect, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { updatePartnersReportEmail, type ActionState } from "./partner-goals-actions";

const initial: ActionState = { error: null };

// Where the monthly Partners rollup also goes (accounting / HR / leadership).
// Blank = the account owner only.
export function PartnersReportEmailForm({ reportEmail, ownerEmail }: { reportEmail: string | null; ownerEmail: string }) {
  const [state, formAction, pending] = useActionState(updatePartnersReportEmail, initial);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Monthly report recipient</div>
      <p className="text-sm text-muted mb-4">
        On the 1st of each month, Wingman emails a Partners rollup across all stores. Add an accounting / HR / leadership
        address to also receive it. Each manager separately gets their own store&apos;s report and follow-up hit list.
      </p>
      <label className="block text-[13px] font-semibold text-ink mb-1">Send the rollup to</label>
      <div className="flex items-end gap-2 flex-wrap">
        <input
          name="reportEmail"
          type="email"
          defaultValue={reportEmail ?? ""}
          placeholder={ownerEmail || "leadership@yourrestaurant.com"}
          className={`${inputClass} max-w-xs`}
        />
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Btn>
        {saved && <span className="text-sm font-semibold text-[#15803D] self-center">Saved ✓</span>}
      </div>
      <p className="text-xs text-muted-2 mt-2">Leave blank to send the rollup to the account owner only.</p>
      {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}
    </form>
  );
}
