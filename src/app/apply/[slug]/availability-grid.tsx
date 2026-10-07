"use client";

import { useState } from "react";
import { AVAIL_DAYS, AVAIL_SHIFTS, ANYTIME } from "@/lib/availability";

// The weekly availability picker on the public application form. Applicants tap
// the shifts they can work, or "Anytime" to say they're flexible. Selections are
// serialized into a hidden input (`availability_shifts`, a JSON array of
// "day:shift" ids, or ["anytime"]) that the submit action reads.
export function AvailabilityGrid({ label, required }: { label: string; required: boolean }) {
  const [anytime, setAnytime] = useState(false);
  const [cells, setCells] = useState<Set<string>>(new Set());

  const value = anytime ? [ANYTIME] : [...cells];
  const toggleCell = (id: string) =>
    setCells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const dayFull = (dayId: string) => AVAIL_SHIFTS.every((s) => cells.has(`${dayId}:${s.id}`));
  const toggleDay = (dayId: string) =>
    setCells((prev) => {
      const next = new Set(prev);
      const full = AVAIL_SHIFTS.every((s) => next.has(`${dayId}:${s.id}`));
      for (const s of AVAIL_SHIFTS) {
        const id = `${dayId}:${s.id}`;
        if (full) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const cell = (on: boolean) =>
    `text-[12.5px] font-semibold rounded-lg px-2 py-2 border text-center transition-colors ${
      on ? "border-brick bg-brick text-white" : "border-line bg-white text-charcoal-2 hover:border-brick"
    }`;

  return (
    <div>
      <label className="text-[13px] font-semibold text-ink block mb-1.5">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>

      <input type="hidden" name="availability_shifts" value={JSON.stringify(value)} />

      <button
        type="button"
        onClick={() => setAnytime((v) => !v)}
        className={`w-full mb-2 text-[13px] font-semibold rounded-xl px-3.5 py-2.5 border transition-colors ${
          anytime ? "border-brick bg-brick text-white" : "border-line bg-white text-ink hover:border-brick"
        }`}
      >
        {anytime ? "✓ " : ""}Anytime — I&rsquo;m flexible
      </button>

      {!anytime && (
        <div className="rounded-xl border border-line overflow-hidden">
          {/* Header row: shift labels */}
          <div className="grid grid-cols-[52px_repeat(3,1fr)] gap-1 p-1.5 bg-panel">
            <span />
            {AVAIL_SHIFTS.map((s) => (
              <span key={s.id} className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2 text-center self-center">
                {s.label}
              </span>
            ))}
          </div>
          {/* One row per day */}
          <div className="flex flex-col gap-1 p-1.5">
            {AVAIL_DAYS.map((d) => (
              <div key={d.id} className="grid grid-cols-[52px_repeat(3,1fr)] gap-1 items-stretch">
                <button
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className={`text-[12.5px] font-bold rounded-lg px-1 border transition-colors ${
                    dayFull(d.id) ? "border-brick bg-brick-tint text-brick-dark" : "border-line bg-white text-ink hover:border-brick"
                  }`}
                  title={`Toggle all of ${d.label}`}
                >
                  {d.label}
                </button>
                {AVAIL_SHIFTS.map((s) => {
                  const id = `${d.id}:${s.id}`;
                  const on = cells.has(id);
                  return (
                    <button key={id} type="button" onClick={() => toggleCell(id)} aria-pressed={on} className={cell(on)}>
                      {on ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] text-muted-2 mt-1.5">
        {anytime ? "You’re marked available any day, any shift." : "Tap the shifts you can work. Tap a day to select all of its shifts."}
      </p>
    </div>
  );
}
