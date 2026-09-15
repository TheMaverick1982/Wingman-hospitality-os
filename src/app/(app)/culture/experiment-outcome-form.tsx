"use client";

import { useState, useTransition } from "react";
import { closeExperiment } from "./actions";

const OUTCOMES: { id: string; label: string }[] = [
  { id: "worked", label: "It worked" },
  { id: "mixed", label: "Mixed" },
  { id: "no_change", label: "No change" },
];

// Shown on the running weekly experiment so an owner can close the loop:
// record whether it worked, add what they learned, and it moves into the
// experiment log (clearing the field for the next test).
export function ExperimentOutcomeForm() {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-[12.5px] font-semibold text-[#b45309] underline underline-offset-2 hover:no-underline"
      >
        How did it go? Record the result →
      </button>
    );
  }

  function save() {
    setMsg(null);
    if (!outcome) {
      setMsg("Pick how it went.");
      return;
    }
    start(async () => {
      const res = await closeExperiment(outcome!, note);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setOpen(false);
      setOutcome(null);
      setNote("");
    });
  }

  return (
    <div className="mt-3 border-t border-[#ffcc80] pt-3">
      <div className="text-[12.5px] font-semibold text-[#b45309] mb-2">How did it go?</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOutcome(o.id)}
            className={`text-[12.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
              outcome === o.id ? "bg-[#b45309] text-white border-[#b45309]" : "border-[#ffcc80] text-[#b45309] hover:bg-[#fff3e0]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={400}
        rows={2}
        placeholder="What did you learn? (optional)"
        className="w-full rounded-lg p-2.5 text-[13px] bg-panel border border-[#ffcc80] text-ink"
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-[12.5px] font-semibold text-white bg-[#b45309] rounded-full px-3.5 py-1.5 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log result"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setMsg(null); }}
          disabled={pending}
          className="text-[12.5px] font-semibold text-[#b45309] hover:underline"
        >
          Cancel
        </button>
        {msg && <span className="text-[12px] font-semibold text-brick">{msg}</span>}
      </div>
    </div>
  );
}
