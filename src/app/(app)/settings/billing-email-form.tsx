"use client";

import { useActionState } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { updateBillingEmail } from "./actions";

const initial = { error: null as string | null };

// Where receipts / invoices are also sent (e.g. an accounting inbox). Optional —
// blank means receipts go to the account owner(s) only.
export function BillingEmailForm({ billingEmail }: { billingEmail: string | null }) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initial, fd: FormData) => {
    const res = await updateBillingEmail(_prev, fd);
    return res;
  }, initial);

  return (
    <form action={formAction} className="mt-5 pt-5 border-t border-line">
      <label className="block text-[13px] font-semibold text-ink mb-1">Send invoices &amp; receipts to</label>
      <p className="text-[12.5px] text-muted-2 mb-2">
        Optional — add an accounting email to also receive every payment receipt. Leave blank to send them only to the
        account owner.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <input
          name="billingEmail"
          type="email"
          defaultValue={billingEmail ?? ""}
          placeholder="accounting@yourrestaurant.com"
          className={`${inputClass} max-w-xs`}
        />
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Btn>
      </div>
      {state.error && <p className="text-sm text-danger mt-2">{state.error}</p>}
    </form>
  );
}
