"use client";

import { useActionState, useState } from "react";
import { recordCommission, type CommissionFormState } from "./actions";

const initial: CommissionFormState = { error: null, ok: false, nonce: 0 };

type Rep = { id: string; name: string };
type Org = { id: string; name: string };

const field = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick disabled:opacity-60";
const lbl = "text-[13px] font-semibold text-charcoal-2 block mb-1.5";

// The editable fields live in their own component keyed by `nonce`, so a
// successful record remounts it fresh (clearing inputs) without any effect.
function Fields({ reps, orgs, pending }: { reps: Rep[]; orgs: Org[]; pending: boolean }) {
  const [kind, setKind] = useState("activation");
  const [amount, setAmount] = useState("125");
  const [label, setLabel] = useState("");

  function applyKind(next: string) {
    setKind(next);
    if (next === "activation") setAmount("125");
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Sales rep</label>
          <select name="rep_profile_id" required disabled={pending} className={field} defaultValue="">
            <option value="" disabled>Choose a rep…</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
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
          <input
            name="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Activation — Joe's Diner"
            required
            disabled={pending}
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>Amount ($)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            disabled={pending}
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Account <span className="text-muted-2 font-normal">(optional)</span></label>
          <select name="org_id" disabled={pending} className={field} defaultValue="">
            <option value="">— none —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Note <span className="text-muted-2 font-normal">(optional)</span></label>
          <input name="note" placeholder="e.g. tail month 1 of 6" disabled={pending} className={field} />
        </div>
      </div>
    </>
  );
}

export function CommissionForm({ reps, orgs }: { reps: Rep[]; orgs: Org[] }) {
  const [state, action, pending] = useActionState(recordCommission, initial);

  return (
    <form action={action} className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
      <Fields key={state.nonce} reps={reps} orgs={orgs} pending={pending} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-60">
          {pending ? "Recording…" : "Record commission"}
        </button>
        {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
        {state.ok && <span className="text-[13px] text-olive font-semibold">Recorded.</span>}
      </div>
    </form>
  );
}
