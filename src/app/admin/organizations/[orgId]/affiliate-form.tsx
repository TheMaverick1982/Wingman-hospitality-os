"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setOrgAffiliate } from "./affiliate-actions";

export function AffiliateForm({
  orgId,
  current,
  affiliates,
}: {
  orgId: string;
  current: string | null;
  affiliates: { id: string; label: string }[];
}) {
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await setOrgAffiliate(orgId, value || null);
      if (res.error) setError(res.error);
      else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-[13px] text-muted-2 flex-1 min-w-[220px]">
        Referred by
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick"
        >
          <option value="">— No affiliate —</option>
          {affiliates.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      <button onClick={save} disabled={pending || value === (current ?? "")} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-olive"><Check size={14} /> Saved</span>}
      {error && <span className="text-[13px] text-danger">{error}</span>}
    </div>
  );
}
