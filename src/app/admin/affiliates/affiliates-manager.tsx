"use client";

import { useActionState, useState, useTransition } from "react";
import {
  approveAffiliate,
  rejectAffiliate,
  setAffiliateStatus,
  updateAffiliateTerms,
  updateProgramSettings,
  type AdminAffState,
} from "./actions";

export type AffRow = {
  id: string;
  fullName: string;
  email: string;
  code: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  commissionPct: number | null;
  cookieDays: number | null;
  paypalEmail: string | null;
  promo: string | null;
  createdAt: string;
  clicks: number;
  signups: number;
  owedCents: number;
};
export type ProgramSettings = { commissionPct: number; termMonths: number; cookieDays: number; minPayoutDollars: number };

const initial: AdminAffState = { error: null };
const field = "rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick w-full";

export function AffiliatesManager({ settings, pending, active }: { settings: ProgramSettings; pending: AffRow[]; active: AffRow[] }) {
  return (
    <div className="flex flex-col gap-8">
      <ProgramSettingsCard settings={settings} />

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-3">
          Applications {pending.length > 0 && <span className="text-brick">({pending.length})</span>}
        </h2>
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          {pending.length === 0 ? (
            <p className="text-sm text-muted p-6">No pending applications.</p>
          ) : (
            pending.map((a) => <PendingCard key={a.id} a={a} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-3">Affiliates</h2>
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          {active.length === 0 ? (
            <p className="text-sm text-muted p-6">No affiliates yet.</p>
          ) : (
            active.map((a) => <ActiveCard key={a.id} a={a} defaults={settings} />)
          )}
        </div>
      </section>
    </div>
  );
}

function ProgramSettingsCard({ settings }: { settings: ProgramSettings }) {
  const [state, action, pending] = useActionState(updateProgramSettings, initial);
  return (
    <section className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <h2 className="text-[15px] font-semibold text-ink mb-4">Program defaults</h2>
      <form action={action} className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        <label className="text-[13px] text-muted-2">
          Commission %
          <input name="commissionPct" type="number" step="0.5" min={0} max={100} defaultValue={settings.commissionPct} className={`${field} mt-1`} />
        </label>
        <label className="text-[13px] text-muted-2">
          Term (months)
          <input name="termMonths" type="number" min={1} max={120} defaultValue={settings.termMonths} className={`${field} mt-1`} />
        </label>
        <label className="text-[13px] text-muted-2">
          Cookie (days)
          <input name="cookieDays" type="number" min={1} max={365} defaultValue={settings.cookieDays} className={`${field} mt-1`} />
        </label>
        <label className="text-[13px] text-muted-2">
          Min payout ($)
          <input name="minPayout" type="number" min={0} step="1" defaultValue={settings.minPayoutDollars} className={`${field} mt-1`} />
        </label>
        <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
          <button type="submit" disabled={pending} className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-60">
            {pending ? "Saving…" : "Save defaults"}
          </button>
          {state.error && <span className="text-sm text-danger">{state.error}</span>}
          {!state.error && state !== initial && <span className="text-sm text-olive font-semibold">Saved.</span>}
        </div>
      </form>
    </section>
  );
}

function PendingCard({ a }: { a: AffRow }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<AdminAffState>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="px-5 py-4 border-b border-[#F5F5F5] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink">{a.fullName || a.email}</div>
          <div className="text-[13px] text-muted-2">{a.email}</div>
          {a.promo && <p className="text-[13px] text-charcoal-2 mt-1.5 max-w-xl">{a.promo}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => act(() => approveAffiliate(a.id))} disabled={busy} className="text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark disabled:opacity-50">
            {busy ? "…" : "Approve"}
          </button>
          <button type="button" onClick={() => act(() => rejectAffiliate(a.id))} disabled={busy} className="text-[13px] font-semibold text-muted hover:text-ink disabled:opacity-50">
            Reject
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}

function ActiveCard({ a, defaults }: { a: AffRow; defaults: ProgramSettings }) {
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(a.commissionPct?.toString() ?? "");
  const [cookie, setCookie] = useState(a.cookieDays?.toString() ?? "");
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await updateAffiliateTerms(a.id, pct === "" ? null : Number(pct), cookie === "" ? null : Number(cookie));
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }
  function toggleSuspend() {
    setError(null);
    start(async () => {
      const res = await setAffiliateStatus(a.id, a.status === "suspended" ? "approved" : "suspended");
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="px-5 py-4 border-b border-[#F5F5F5] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink flex items-center gap-2">
            {a.fullName || a.email}
            {a.status === "suspended" && <span className="text-[11px] font-semibold text-[#B45309] bg-[#FDF3E1] px-2 py-0.5 rounded-full">Suspended</span>}
            {a.status === "rejected" && <span className="text-[11px] font-semibold text-muted bg-paper px-2 py-0.5 rounded-full">Rejected</span>}
          </div>
          <div className="text-[13px] text-muted-2">{a.email}{a.code ? ` · code: ${a.code}` : ""}</div>
          <div className="text-[13px] text-charcoal-2 mt-1">
            {a.clicks} clicks · {a.signups} signups · {a.commissionPct ?? defaults.commissionPct}% · {a.cookieDays ?? defaults.cookieDays}d cookie
            {a.paypalEmail ? ` · PayPal: ${a.paypalEmail}` : " · no PayPal yet"}
          </div>
          {a.owedCents > 0 && (
            <div className="text-[13px] font-semibold text-olive mt-0.5">${(a.owedCents / 100).toFixed(2)} owed (approved)</div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70">
            {editing ? "Cancel" : "Edit"}
          </button>
          {a.status !== "rejected" && (
            <button type="button" onClick={toggleSuspend} disabled={busy} className="text-[13px] font-semibold text-brick hover:opacity-70 disabled:opacity-50">
              {a.status === "suspended" ? "Reinstate" : "Suspend"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[13px] text-muted-2">
            Commission % <span className="text-muted-2">(blank = {defaults.commissionPct}%)</span>
            <input type="number" step="0.5" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={`${field} mt-1 w-36`} />
          </label>
          <label className="text-[13px] text-muted-2">
            Cookie days <span className="text-muted-2">(blank = {defaults.cookieDays})</span>
            <input type="number" min={1} max={365} value={cookie} onChange={(e) => setCookie(e.target.value)} className={`${field} mt-1 w-36`} />
          </label>
          <button type="button" onClick={save} disabled={busy} className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
