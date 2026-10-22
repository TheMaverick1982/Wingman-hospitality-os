"use client";

import { useActionState, useState, useTransition } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { updatePartnersReport, sendPartnersReportTestNow, type ActionState } from "./partner-goals-actions";

const initialState: ActionState = { error: null };

const DAYS = [
  { v: 1, label: "Monday" },
  { v: 2, label: "Tuesday" },
  { v: 3, label: "Wednesday" },
  { v: 4, label: "Thursday" },
  { v: 5, label: "Friday" },
  { v: 6, label: "Saturday" },
  { v: 0, label: "Sunday" },
];

export function PartnersReportForm({
  frequency,
  day,
  mode,
  emails,
  ownerEmail,
}: {
  frequency: "off" | "weekly" | "monthly";
  day: number;
  mode: "combined" | "per_location";
  emails: string;
  ownerEmail: string;
}) {
  const [state, formAction, pending] = useActionState(updatePartnersReport, initialState);
  const [freq, setFreq] = useState(frequency);
  const [dlv, setDlv] = useState(mode);
  const [dayVal, setDayVal] = useState(String(day));
  const [testing, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function sendTest() {
    setTestMsg(null);
    startTest(async () => {
      const res = await sendPartnersReportTestNow();
      setTestMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: `Sent a test to ${ownerEmail}.` });
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-display text-lg font-semibold text-ink">Partners report</h3>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brick bg-brick-tint rounded-full px-2 py-0.5">Owner only</span>
      </div>
      <p className="text-sm text-muted mb-4">
        An accountability digest — new contacts, touches (and who logged them), bookings, revenue, and who&apos;s gone cold —
        emailed on the schedule you pick. The owner always receives it; add anyone else below.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        {/* Cadence */}
        <div>
          <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Schedule</label>
          <div className="inline-flex gap-1.5 bg-panel border border-line rounded-full p-1">
            {(["off", "weekly", "monthly"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setFreq(o)}
                className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 capitalize transition-colors ${freq === o ? "bg-brick text-white" : "text-charcoal-2 hover:text-ink"}`}
              >
                {o}
              </button>
            ))}
          </div>
          <input type="hidden" name="frequency" value={freq} />
        </div>

        {freq === "weekly" && (
          <label className="flex flex-col gap-1.5 text-sm max-w-[220px]">
            <span className="font-semibold text-ink">Send on</span>
            <select name="day" value={dayVal} onChange={(e) => setDayVal(e.target.value)} className={inputClass}>
              {DAYS.map((d) => (
                <option key={d.v} value={String(d.v)}>{d.label}</option>
              ))}
            </select>
          </label>
        )}

        {freq !== "off" && (
          <>
            {/* Delivery */}
            <div>
              <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Delivery</label>
              <div className="inline-flex gap-1.5 bg-panel border border-line rounded-full p-1">
                <button type="button" onClick={() => setDlv("combined")} className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 transition-colors ${dlv === "combined" ? "bg-brick text-white" : "text-charcoal-2 hover:text-ink"}`}>
                  One combined email
                </button>
                <button type="button" onClick={() => setDlv("per_location")} className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 transition-colors ${dlv === "per_location" ? "bg-brick text-white" : "text-charcoal-2 hover:text-ink"}`}>
                  Individually (per location)
                </button>
              </div>
              <input type="hidden" name="mode" value={dlv} />
              <p className="text-[12px] text-muted-2 mt-1.5">
                {dlv === "combined" ? "All locations stacked in one email." : "A separate email for each location."}
              </p>
            </div>

            {/* Recipients */}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Also send to</span>
              <textarea
                name="emails"
                defaultValue={emails}
                rows={2}
                placeholder="gm@company.com, accounting@company.com"
                className={inputClass}
              />
              <span className="text-[12px] text-muted-2">Add as many as you like — separate with commas or new lines. The owner ({ownerEmail || "you"}) always gets it.</span>
            </label>
          </>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Btn type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Btn>
          {freq !== "off" && (
            <Btn type="button" kind="ghost" onClick={sendTest} disabled={testing}>
              {testing ? "Sending…" : "Send me a test"}
            </Btn>
          )}
          {state.ok && <span className="text-[12.5px] font-semibold text-olive">Saved</span>}
          {state.error && <span className="text-[12.5px] font-semibold text-danger">{state.error}</span>}
          {testMsg && <span className={`text-[12.5px] font-semibold ${testMsg.ok ? "text-olive" : "text-danger"}`}>{testMsg.text}</span>}
        </div>
      </form>
    </div>
  );
}
