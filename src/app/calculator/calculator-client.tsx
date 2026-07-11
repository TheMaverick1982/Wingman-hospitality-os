"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HoneypotField } from "@/components/honeypot-field";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import { captureLead } from "../lead-actions";

const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors";
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function CalculatorClient() {
  const [guests, setGuests] = useState(400); // new guests / month
  const [check, setCheck] = useState(35); // average check $
  const [current, setCurrent] = useState(25); // current repeat rate %
  const [target, setTarget] = useState(35); // target repeat rate %
  const [visits, setVisits] = useState(6); // visits / year for a regular

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const lift = Math.max(0, target - current) / 100;
    const extraRegularsYear = guests * 12 * lift;
    const perYear = extraRegularsYear * Math.max(0, visits - 1) * check;
    return { extraRegularsYear, perYear, perMonth: perYear / 12 };
  }, [guests, check, current, target, visits]);

  async function emailMe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const hp = String(new FormData(e.currentTarget).get(HONEYPOT_FIELD) ?? "");
    const res = await captureLead({
      source: "calculator",
      email,
      hp,
      payload: { guests, check, current, target, visits, perYear: Math.round(result.perYear) },
      summary: `${guests} new guests/mo · $${check} check · ${current}%→${target}% repeat · est. +${money(result.perYear)}/yr`,
      resultHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;">
        <p style="font-size:16px;">Here's your Wingman revenue estimate:</p>
        <p style="font-size:28px;font-weight:700;margin:6px 0;">${money(result.perYear)} / year</p>
        <p style="font-size:15px;color:#525252;">by lifting your repeat rate from ${current}% to ${target}% (${Math.round(result.extraRegularsYear).toLocaleString()} more regulars a year).</p>
        <p style="font-size:15px;">Ready to make it real? <a href="https://www.joinwingman.app/signup" style="color:#0a6cff;font-weight:600;">Get Started</a> or <a href="https://www.joinwingman.app/book-a-demo" style="color:#0a6cff;font-weight:600;">book a demo</a>.</p>
      </div>`,
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Inputs */}
      <div className="bg-white border border-line rounded-[22px] p-6 sm:p-8 shadow-sm flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-[13px] font-semibold text-ink">
            New guests / month
            <input type="number" min={0} value={guests} onChange={(e) => setGuests(Math.max(0, Number(e.target.value)))} className={`${field} mt-1.5`} />
          </label>
          <label className="text-[13px] font-semibold text-ink">
            Average check ($)
            <input type="number" min={0} value={check} onChange={(e) => setCheck(Math.max(0, Number(e.target.value)))} className={`${field} mt-1.5`} />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between text-[13px] font-semibold text-ink mb-1.5">
            <span>Current repeat rate</span>
            <span className="text-muted-2">{current}%</span>
          </div>
          <input type="range" min={0} max={90} value={current} onChange={(e) => { const v = Number(e.target.value); setCurrent(v); if (target < v) setTarget(v); }} className="w-full accent-brick" />
        </div>

        <div>
          <div className="flex items-center justify-between text-[13px] font-semibold text-ink mb-1.5">
            <span>Target repeat rate</span>
            <span className="text-brick">{target}%</span>
          </div>
          <input type="range" min={current} max={95} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-brick" />
        </div>

        <label className="text-[13px] font-semibold text-ink">
          Visits per year for a regular
          <input type="number" min={1} value={visits} onChange={(e) => setVisits(Math.max(1, Number(e.target.value)))} className={`${field} mt-1.5 max-w-[140px]`} />
        </label>
      </div>

      {/* Result */}
      <div className="bg-[#0A0A0A] rounded-[22px] p-6 sm:p-8 shadow-2xl text-white flex flex-col">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-[#8FB6FF]">Estimated added revenue</div>
        <div className="text-5xl sm:text-6xl font-bold tracking-[-0.03em] mt-2">{money(result.perYear)}<span className="text-2xl text-[#A1A1A1] font-medium"> / yr</span></div>
        <div className="text-[15px] text-[#A1A1A1] mt-1">≈ {money(result.perMonth)} / month</div>

        <div className="mt-5 text-[14px] text-[#E5E5E5] leading-relaxed">
          Lifting repeat rate from <strong>{current}%</strong> to <strong>{target}%</strong> turns about{" "}
          <strong className="text-white">{Math.round(result.extraRegularsYear).toLocaleString()}</strong> more first-timers into regulars a year.
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          {sent ? (
            <p className="text-[15px] text-[#8FB6FF] font-semibold">Sent — check your inbox for the full breakdown.</p>
          ) : (
            <form onSubmit={emailMe} className="flex flex-col gap-2.5">
              <HoneypotField />
              <div className="text-[14px] text-[#E5E5E5]">Email me this breakdown:</div>
              <div className="flex gap-2">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" className="flex-1 rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-[15px] text-white placeholder:text-white/40 outline-none focus:border-white/40" />
                <button type="submit" disabled={busy} className="shrink-0 text-[15px] font-semibold text-white bg-brick rounded-xl px-5 hover:bg-brick-dark disabled:opacity-60">
                  {busy ? "…" : "Send"}
                </button>
              </div>
              {error && <p className="text-[13px] text-red-300">{error}</p>}
            </form>
          )}
          <div className="flex items-center gap-3 mt-5">
            <Link href="/signup" className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors">Get Started</Link>
            <Link href="/book-a-demo" className="text-[15px] font-semibold text-white/90 hover:text-white">Book a demo →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
