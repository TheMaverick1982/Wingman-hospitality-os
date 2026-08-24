"use client";

import { useMemo, useState } from "react";

// A live "aggregation of marginal gains" planner: nudge three channels a few
// percent each and watch how they compound into a big annual-revenue lift. The
// math is real — the levers feed one revenue model, so their gains multiply
// rather than just add. Every channel maps to a Wingman system.
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Fixed baseline assumptions the sliders improve (kept off the UI to stay simple).
const BASE_REPEAT_RATE = 25; // % of new guests who become repeat guests
const BASE_RETURN_VISITS = 5; // extra visits/yr per repeat guest

type Lever = { key: string; label: string; sub: string };
const LEVERS: Lever[] = [
  { key: "repeat", label: "Returning guests", sub: "More first-timers come back, and more often — guest retention" },
  { key: "check", label: "Average check", sub: "Better recommendations & upsells — staff training" },
  { key: "traffic", label: "New guests", sub: "A stronger rating pulls more people in — reviews" },
];

function annualRevenue(guests: number, check: number, repeatPct: number, returnVisits: number): number {
  const firstVisits = guests * 12 * check;
  const repeatGuests = guests * 12 * (repeatPct / 100);
  const repeatVisits = repeatGuests * returnVisits * check;
  return firstVisits + repeatVisits;
}

export function RevenuePlanner() {
  const [guests, setGuests] = useState(800); // new guests / month
  const [check, setCheck] = useState(32); // average check $
  const [lift, setLift] = useState<Record<string, number>>({ repeat: 5, check: 5, traffic: 5 });

  const set = (k: string, v: number) => setLift((p) => ({ ...p, [k]: v }));

  const { base, projected, delta, pct } = useMemo(() => {
    const base = annualRevenue(guests, check, BASE_REPEAT_RATE, BASE_RETURN_VISITS);
    const projected = annualRevenue(
      guests * (1 + lift.traffic / 100),
      check * (1 + lift.check / 100),
      BASE_REPEAT_RATE * (1 + lift.repeat / 100),
      BASE_RETURN_VISITS,
    );
    const delta = projected - base;
    return { base, projected, delta, pct: base > 0 ? (delta / base) * 100 : 0 };
  }, [guests, check, lift]);

  const barPct = projected > 0 ? Math.round((base / projected) * 100) : 100;

  return (
    <div className="bg-white border border-line rounded-3xl p-6 sm:p-8 shadow-lg">
      {/* Headline result */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-[12.5px] font-semibold tracking-[0.06em] uppercase text-muted-2 mb-1">Added revenue / year</div>
          <div className="font-display text-[42px] sm:text-[52px] leading-none font-bold text-[#15803D] tabular-nums">+{usd0.format(Math.round(delta))}</div>
        </div>
        <div className="sm:text-right">
          <div className="text-[13px] text-muted-2">A <span className="font-semibold text-ink">{pct.toFixed(0)}%</span> lift — from just a few points per channel.</div>
          <div className="text-[12.5px] text-muted-2 mt-0.5 tabular-nums">{usd0.format(Math.round(base))} → <span className="font-semibold text-ink">{usd0.format(Math.round(projected))}</span></div>
        </div>
      </div>

      {/* Before / after bar */}
      <div className="mb-7">
        <div className="h-8 rounded-full bg-paper overflow-hidden flex">
          <div className="h-full bg-charcoal-2/80 flex items-center pl-3" style={{ width: `${Math.max(barPct, 22)}%` }}>
            <span className="text-[11.5px] font-semibold text-white whitespace-nowrap">Today</span>
          </div>
          <div className="h-full bg-[#15803D] flex-1 flex items-center justify-end pr-3">
            <span className="text-[11.5px] font-semibold text-white whitespace-nowrap">With Wingman</span>
          </div>
        </div>
      </div>

      {/* Your numbers */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <label className="block">
          <span className="text-[12.5px] font-semibold text-ink">New guests / month</span>
          <input type="number" min={0} value={guests} onChange={(e) => setGuests(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[15px] text-ink outline-none focus:border-brick tabular-nums" />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-semibold text-ink">Average check</span>
          <div className="mt-1 flex items-center rounded-xl border border-line bg-white px-3 focus-within:border-brick">
            <span className="text-muted-2 text-[15px]">$</span>
            <input type="number" min={0} value={check} onChange={(e) => setCheck(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-transparent px-1.5 py-2 text-[15px] text-ink outline-none tabular-nums" />
          </div>
        </label>
      </div>

      {/* Levers */}
      <div className="flex flex-col gap-4">
        <div className="text-[12.5px] font-semibold tracking-[0.06em] uppercase text-muted-2">Improve each channel</div>
        {LEVERS.map((l) => (
          <div key={l.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <span className="text-[14px] font-semibold text-ink">{l.label}</span>
                <span className="text-[12px] text-muted-2 block leading-tight">{l.sub}</span>
              </div>
              <span className="text-[15px] font-bold text-brick tabular-nums shrink-0">+{lift[l.key]}%</span>
            </div>
            <input type="range" min={0} max={25} step={1} value={lift[l.key]} onChange={(e) => set(l.key, Number(e.target.value))}
              aria-label={`Improve ${l.label}`} className="w-full accent-brick cursor-pointer" />
          </div>
        ))}
      </div>

      <p className="text-[12px] text-muted-2 mt-6 leading-[1.5]">
        Illustrative model — the three channels feed one revenue projection, so their gains <span className="font-semibold text-ink">compound</span> instead of just adding up. That&rsquo;s why a few points each turns into a number this big.
      </p>
    </div>
  );
}
