"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

type Opt = { type: string; label: string };

// "Print / PDF" with a small picker so the owner chooses which checklists go
// into the printout (all by default). Opens the print view with a ?lists= query.
export function PrintChecklistsButton({ options }: { options: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(options.map((o) => o.type));
  const allTypes = options.map((o) => o.type);
  const allOn = sel.length === options.length;

  const toggle = (t: string) => setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const toggleAll = () => setSel(allOn ? [] : allTypes);

  function go() {
    if (sel.length === 0) return;
    const q = allOn ? "" : `?lists=${sel.join(",")}`;
    window.open(`/print/accountability${q}`, "_blank", "noopener");
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors"
      >
        <Printer size={14} /> Print / PDF
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-hidden tabIndex={-1} />
          <div className="absolute right-0 mt-2 z-20 w-64 bg-white border border-line rounded-xl shadow-lg p-3">
            <div className="text-[12px] font-semibold text-muted mb-2">Include which checklists?</div>
            <label className="flex items-center gap-2.5 text-[13px] font-semibold text-ink cursor-pointer py-1">
              <input type="checkbox" checked={allOn} onChange={toggleAll} className="accent-brick w-4 h-4" />
              All checklists
            </label>
            <div className="border-t border-line my-2" />
            <div className="flex flex-col gap-0.5">
              {options.map((o) => (
                <label key={o.type} className="flex items-center gap-2.5 text-[13px] text-charcoal-2 cursor-pointer py-1">
                  <input type="checkbox" checked={sel.includes(o.type)} onChange={() => toggle(o.type)} className="accent-brick w-4 h-4" />
                  {o.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={go}
              disabled={sel.length === 0}
              className="w-full mt-3 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors disabled:opacity-50"
            >
              Open print view
            </button>
          </div>
        </>
      )}
    </div>
  );
}
