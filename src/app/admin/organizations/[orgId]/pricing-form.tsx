"use client";

import { useState, useTransition } from "react";
import { updateOrgPricing } from "../actions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick";
const dollars = (cents: number | null) => (cents == null ? "" : (cents / 100).toString());

export function PricingForm({
  orgId,
  monthlyCents,
  addlCents,
  note,
  effectiveLabel,
  baseDollars = 399,
}: {
  orgId: string;
  monthlyCents: number | null;
  addlCents: number | null;
  note: string;
  effectiveLabel: string;
  baseDollars?: number;
}) {
  const [monthly, setMonthly] = useState(dollars(monthlyCents));
  const [addl, setAddl] = useState(dollars(addlCents));
  const [noteVal, setNoteVal] = useState(note);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("monthly", monthly);
    fd.set("addl", addl);
    fd.set("note", noteVal);
    start(async () => {
      const res = await updateOrgPricing(orgId, fd);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] text-charcoal-2">
        Current price: <span className="font-semibold text-ink">{effectiveLabel}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-[13px] text-muted-2">
          Flat monthly price ($)
          <input type="number" min={0} step="1" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="e.g. 900" className={`${field} mt-1`} />
          <span className="block text-[12px] text-muted-2 mt-1">Overrides everything. Blank = standard.</span>
        </label>
        <label className="text-[13px] text-muted-2">
          Per-additional-location price ($)
          <input type="number" min={0} step="1" value={addl} onChange={(e) => setAddl(e.target.value)} placeholder="e.g. 60" className={`${field} mt-1`} />
          <span className="block text-[12px] text-muted-2 mt-1">Keeps the ${baseDollars} base. Ignored if a flat price is set.</span>
        </label>
      </div>

      <label className="text-[13px] text-muted-2">
        Note (why — for your reference only)
        <input type="text" value={noteVal} onChange={(e) => setNoteVal(e.target.value)} placeholder="e.g. negotiated Jan 2026, 40 locations" className={`${field} mt-1`} />
      </label>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-60">
          {pending ? "Saving…" : "Save pricing"}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
        {saved && !error && <span className="text-sm text-olive font-semibold">Saved.</span>}
      </div>
    </div>
  );
}
