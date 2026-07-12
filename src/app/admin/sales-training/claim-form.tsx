"use client";

import { useActionState, useState } from "react";
import { claimCommission, type ClaimState } from "./actions";

const initial: ClaimState = { error: null, ok: false, nonce: 0 };

type Org = { id: string; name: string };

const field = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick disabled:opacity-60";
const lbl = "text-[13px] font-semibold text-charcoal-2 block mb-1.5";

// Fields live in a child keyed by nonce, so a successful claim remounts (clears)
// them with no setState-in-effect.
function Fields({ orgs, pending }: { orgs: Org[]; pending: boolean }) {
  const [kind, setKind] = useState("activation");
  const [amount, setAmount] = useState("125");

  function applyKind(next: string) {
    setKind(next);
    if (next === "activation") setAmount("125");
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Account you closed</label>
          <select name="org_id" disabled={pending} className={field} defaultValue="">
            <option value="">— pick the account —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Type</label>
          <select name="kind" value={kind} onChange={(e) => applyKind(e.target.value)} disabled={pending} className={field}>
            <option value="activation">Activation bonus ($125 / location)</option>
            <option value="tail">Recurring tail (5% of monthly)</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
        <div>
          <label className={lbl}>Label</label>
          <input name="label" placeholder="e.g. Activation — Joe's Diner" required disabled={pending} className={field} />
        </div>
        <div>
          <label className={lbl}>Amount ($)</label>
          <input name="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={pending} className={field} />
        </div>
      </div>

      <div>
        <label className={lbl}>Note for the owner <span className="text-muted-2 font-normal">(optional)</span></label>
        <input name="note" placeholder="e.g. closed on 7/10, first location" disabled={pending} className={field} />
      </div>
    </>
  );
}

export function ClaimForm({ orgs }: { orgs: Org[] }) {
  const [state, action, pending] = useActionState(claimCommission, initial);

  return (
    <details className="bg-white border border-line rounded-2xl group">
      <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none">
        <div>
          <div className="text-[15px] font-semibold text-ink">Claim a commission</div>
          <div className="text-[13px] text-muted mt-0.5">Assign yourself to an account you closed. It goes to the owner for approval before it counts.</div>
        </div>
        <span className="text-muted-2 text-sm group-open:rotate-180 transition-transform">⌄</span>
      </summary>
      <form action={action} className="px-5 pb-5 flex flex-col gap-4">
        <Fields key={state.nonce} orgs={orgs} pending={pending} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-60">
            {pending ? "Submitting…" : "Submit for approval"}
          </button>
          {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
          {state.ok && <span className="text-[13px] text-olive font-semibold">Submitted — pending the owner&rsquo;s approval.</span>}
        </div>
      </form>
    </details>
  );
}
