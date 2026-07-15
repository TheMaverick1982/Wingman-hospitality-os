"use client";

import { useState, useTransition } from "react";
import { PlugZap, RefreshCw, Check } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { disconnectSquare, syncSquareNow, connectSquareSandboxToken } from "./square-actions";
import { disconnectClover, syncCloverNow } from "./clover-actions";
import { disconnectToast, syncToastNow, connectToast } from "./toast-actions";
import { disconnectLightspeed, syncLightspeedNow } from "./lightspeed-actions";

export type SquareConnection = {
  merchantId: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncGuests: number;
  lastSyncSalesCents: number;
};

export type CloverConnection = {
  merchantId: string;
  merchantName: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
};

export type ToastConnection = {
  restaurantGuid: string;
  restaurantName: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
};

export type LightspeedConnection = {
  accountId: string;
  accountName: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
};

function fmt(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function OnboardingPill() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A3412] bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-1 rounded-full">
      Onboarding in progress
    </span>
  );
}

// Direct POS integrations. Each POS is a row; platforms still in partner
// onboarding show an "Onboarding in progress" pill until their credentials are
// live. Rows are listed alphabetically.
export function DirectIntegrations({
  configured,
  connection,
  sandboxTokenAvailable,
  cloverConfigured,
  cloverConnections = [],
  toastConfigured,
  toastConnections = [],
  lightspeedConfigured,
  lightspeedConnections = [],
}: {
  configured: boolean;
  connection: SquareConnection | null;
  sandboxTokenAvailable?: boolean;
  cloverConfigured?: boolean;
  cloverConnections?: CloverConnection[];
  toastConfigured?: boolean;
  toastConnections?: ToastConnection[];
  lightspeedConfigured?: boolean;
  lightspeedConnections?: LightspeedConnection[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [cloverPending, startClover] = useTransition();
  const [cloverMsg, setCloverMsg] = useState<string | null>(null);
  const [cloverErr, setCloverErr] = useState<string | null>(null);

  const [lsPending, startLs] = useTransition();
  const [lsMsg, setLsMsg] = useState<string | null>(null);
  const [lsErr, setLsErr] = useState<string | null>(null);

  const [toastPending, startToast] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastErr, setToastErr] = useState<string | null>(null);
  const [toastGuid, setToastGuid] = useState("");

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Direct integrations</div>
      <p className="text-sm text-muted mb-5">
        Connect your POS to sync automatically — no API key or Zapier needed. More platforms coming soon.
      </p>

      {/* ---------- Clover ---------- */}
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#3AA935] text-white flex items-center justify-center shrink-0 font-semibold">CL</div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink flex items-center gap-2">
                Clover
                {cloverConnections.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] bg-[#E7F6EC] px-2 py-0.5 rounded-full">
                    <Check size={11} /> {cloverConnections.length} store{cloverConnections.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-muted-2">Sync customers → Guests and sales → Business Health, per store</div>
            </div>
          </div>
          <div className="shrink-0">
            {!cloverConfigured ? (
              <OnboardingPill />
            ) : (
              <div className="flex items-center gap-2">
                {cloverConnections.length > 0 && (
                  <Btn
                    small
                    kind="ghost"
                    icon={RefreshCw}
                    disabled={cloverPending}
                    onClick={() => {
                      setCloverErr(null); setCloverMsg(null);
                      startClover(async () => {
                        const res = await syncCloverNow();
                        if (res.error) setCloverErr(res.error);
                        else setCloverMsg(`Synced — ${res.guests} new guest${res.guests === 1 ? "" : "s"}, ${money(res.salesCents)} in sales.`);
                      });
                    }}
                  >
                    {cloverPending ? "Syncing…" : "Sync now"}
                  </Btn>
                )}
                <a
                  href="/api/integrations/clover/connect"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors"
                >
                  <PlugZap size={14} /> {cloverConnections.length > 0 ? "Connect another" : "Connect Clover"}
                </a>
              </div>
            )}
          </div>
        </div>

        {cloverConnections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
            {cloverConnections.map((c) => (
              <div key={c.merchantId} className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[12.5px] text-muted-2 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="font-medium text-ink">{c.merchantName || c.merchantId}</span>
                  <span>Last sync: {fmt(c.lastSyncAt)}</span>
                  {c.lastSyncStatus && c.lastSyncStatus !== "ok" && <span className="text-danger">{c.lastSyncStatus}</span>}
                </div>
                <button
                  type="button"
                  disabled={cloverPending}
                  onClick={() => {
                    if (!window.confirm(`Disconnect ${c.merchantName || "this Clover store"}? Wingman will stop syncing it.`)) return;
                    setCloverErr(null); setCloverMsg(null);
                    startClover(async () => {
                      const res = await disconnectClover(c.merchantId);
                      if (res.error) setCloverErr(res.error);
                    });
                  }}
                  className="text-[12.5px] font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
        {cloverMsg && <p className="text-sm text-[#15803D] mt-3">{cloverMsg}</p>}
        {cloverErr && <p className="text-sm text-danger mt-3">{cloverErr}</p>}
      </div>

      {/* ---------- Global Payments (Genius POS) ---------- */}
      <div className="rounded-xl border border-line p-4 mt-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0A2540] text-white flex items-center justify-center shrink-0 font-semibold">GP</div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink">Global Payments <span className="text-muted-2 font-normal">(Genius POS)</span></div>
              <div className="text-[12.5px] text-muted-2">Sync sales → Business Health and customers → Guests, per location</div>
            </div>
          </div>
          <div className="shrink-0">
            <OnboardingPill />
          </div>
        </div>
      </div>

      {/* ---------- Lightspeed ---------- */}
      <div className="rounded-xl border border-line p-4 mt-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F5334F] text-white flex items-center justify-center shrink-0 font-semibold">LS</div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink flex items-center gap-2">
                Lightspeed
                {lightspeedConnections.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] bg-[#E7F6EC] px-2 py-0.5 rounded-full">
                    <Check size={11} /> {lightspeedConnections.length} account{lightspeedConnections.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-muted-2">Sync customers → Guests and sales → Business Health, per account</div>
            </div>
          </div>
          <div className="shrink-0">
            {!lightspeedConfigured ? (
              <OnboardingPill />
            ) : (
              <div className="flex items-center gap-2">
                {lightspeedConnections.length > 0 && (
                  <Btn
                    small
                    kind="ghost"
                    icon={RefreshCw}
                    disabled={lsPending}
                    onClick={() => {
                      setLsErr(null); setLsMsg(null);
                      startLs(async () => {
                        const res = await syncLightspeedNow();
                        if (res.error) setLsErr(res.error);
                        else setLsMsg(`Synced — ${res.guests} new guest${res.guests === 1 ? "" : "s"}, ${money(res.salesCents)} in sales.`);
                      });
                    }}
                  >
                    {lsPending ? "Syncing…" : "Sync now"}
                  </Btn>
                )}
                <a
                  href="/api/integrations/lightspeed/connect"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors"
                >
                  <PlugZap size={14} /> {lightspeedConnections.length > 0 ? "Connect another" : "Connect Lightspeed"}
                </a>
              </div>
            )}
          </div>
        </div>

        {lightspeedConnections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
            {lightspeedConnections.map((c) => (
              <div key={c.accountId} className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[12.5px] text-muted-2 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="font-medium text-ink">{c.accountName || c.accountId}</span>
                  <span>Last sync: {fmt(c.lastSyncAt)}</span>
                  {c.lastSyncStatus && c.lastSyncStatus !== "ok" && <span className="text-danger">{c.lastSyncStatus}</span>}
                </div>
                <button
                  type="button"
                  disabled={lsPending}
                  onClick={() => {
                    if (!window.confirm(`Disconnect ${c.accountName || "this Lightspeed account"}? Wingman will stop syncing it.`)) return;
                    setLsErr(null); setLsMsg(null);
                    startLs(async () => {
                      const res = await disconnectLightspeed(c.accountId);
                      if (res.error) setLsErr(res.error);
                    });
                  }}
                  className="text-[12.5px] font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
        {lsMsg && <p className="text-sm text-[#15803D] mt-3">{lsMsg}</p>}
        {lsErr && <p className="text-sm text-danger mt-3">{lsErr}</p>}
      </div>

      {/* ---------- Square ---------- */}
      <div className="rounded-xl border border-line p-4 mt-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center shrink-0 font-semibold">SQ</div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink flex items-center gap-2">
                Square
                {connection && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] bg-[#E7F6EC] px-2 py-0.5 rounded-full">
                    <Check size={11} /> Connected
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-muted-2">
                {connection ? `Syncs customers → Guests and sales → Business Health` : "Sync customers and sales automatically"}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            {!configured ? (
              <OnboardingPill />
            ) : connection ? (
              <div className="flex items-center gap-2">
                <Btn
                  small
                  kind="ghost"
                  icon={RefreshCw}
                  disabled={pending}
                  onClick={() => {
                    setErr(null); setMsg(null);
                    start(async () => {
                      const res = await syncSquareNow();
                      if (res.error) setErr(res.error);
                      else setMsg(`Synced — ${res.guests} new guest${res.guests === 1 ? "" : "s"}, ${money(res.salesCents)} in sales.`);
                    });
                  }}
                >
                  {pending ? "Syncing…" : "Sync now"}
                </Btn>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Disconnect Square? Wingman will stop syncing until you reconnect.")) return;
                    setErr(null); setMsg(null);
                    start(async () => {
                      const res = await disconnectSquare();
                      if (res.error) setErr(res.error);
                    });
                  }}
                  className="text-sm font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <a
                  href="/api/integrations/square/connect"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors"
                >
                  <PlugZap size={14} /> Connect Square
                </a>
                {sandboxTokenAvailable && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setErr(null); setMsg(null);
                      start(async () => {
                        const res = await connectSquareSandboxToken();
                        if (res.error) setErr(res.error);
                        else setMsg(`Connected via sandbox token — ${res.guests} new guest${res.guests === 1 ? "" : "s"}, ${money(res.salesCents)} in sales.`);
                      });
                    }}
                    className="text-[12px] font-medium text-muted-2 hover:text-ink disabled:opacity-50"
                  >
                    {pending ? "Testing…" : "Test with sandbox token"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {connection && (
          <div className="mt-3 pt-3 border-t border-line text-[12.5px] text-muted-2 flex flex-wrap gap-x-5 gap-y-1">
            <span>Connected {fmt(connection.connectedAt)}</span>
            <span>Last sync: {fmt(connection.lastSyncAt)}</span>
            {connection.lastSyncStatus && connection.lastSyncStatus !== "ok" && (
              <span className="text-danger">{connection.lastSyncStatus}</span>
            )}
          </div>
        )}
        {msg && <p className="text-sm text-[#15803D] mt-3">{msg}</p>}
        {err && <p className="text-sm text-danger mt-3">{err}</p>}
      </div>

      {/* ---------- Toast ---------- */}
      <div className="rounded-xl border border-line p-4 mt-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FF4C00] text-white flex items-center justify-center shrink-0 font-semibold">TO</div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink flex items-center gap-2">
                Toast
                {toastConnections.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] bg-[#E7F6EC] px-2 py-0.5 rounded-full">
                    <Check size={11} /> {toastConnections.length} restaurant{toastConnections.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-muted-2">Sync guests → Guests and sales → Business Health, per restaurant</div>
            </div>
          </div>
          <div className="shrink-0">
            {!toastConfigured ? (
              <OnboardingPill />
            ) : (
              toastConnections.length > 0 && (
                <Btn
                  small
                  kind="ghost"
                  icon={RefreshCw}
                  disabled={toastPending}
                  onClick={() => {
                    setToastErr(null); setToastMsg(null);
                    startToast(async () => {
                      const res = await syncToastNow();
                      if (res.error) setToastErr(res.error);
                      else setToastMsg(`Synced — ${res.guests} new guest${res.guests === 1 ? "" : "s"}, ${money(res.salesCents)} in sales.`);
                    });
                  }}
                >
                  {toastPending ? "Syncing…" : "Sync now"}
                </Btn>
              )
            )}
          </div>
        </div>

        {/* Connect by Restaurant GUID (Toast has no OAuth redirect). */}
        {toastConfigured && (
          <div className="mt-3 pt-3 border-t border-line">
            <label className="block text-[12.5px] font-semibold text-ink mb-1">Add a restaurant</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={toastGuid}
                onChange={(e) => setToastGuid(e.target.value)}
                placeholder="Toast Restaurant GUID"
                className="flex-1 min-w-[220px] rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brick"
              />
              <button
                type="button"
                disabled={toastPending || !toastGuid.trim()}
                onClick={() => {
                  setToastErr(null); setToastMsg(null);
                  startToast(async () => {
                    const res = await connectToast(toastGuid);
                    if (res.error) setToastErr(res.error);
                    else { setToastMsg(`Connected ${res.name ?? "restaurant"}.`); setToastGuid(""); }
                  });
                }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50 transition-colors"
              >
                <PlugZap size={14} /> {toastPending ? "Connecting…" : "Connect"}
              </button>
            </div>
            <p className="text-[11.5px] text-muted-2 mt-1.5">Enable Wingman in your Toast account, then paste your Restaurant GUID here.</p>
          </div>
        )}

        {toastConnections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
            {toastConnections.map((c) => (
              <div key={c.restaurantGuid} className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[12.5px] text-muted-2 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="font-medium text-ink">{c.restaurantName || c.restaurantGuid}</span>
                  <span>Last sync: {fmt(c.lastSyncAt)}</span>
                  {c.lastSyncStatus && c.lastSyncStatus !== "ok" && <span className="text-danger">{c.lastSyncStatus}</span>}
                </div>
                <button
                  type="button"
                  disabled={toastPending}
                  onClick={() => {
                    if (!window.confirm(`Disconnect ${c.restaurantName || "this Toast restaurant"}? Wingman will stop syncing it.`)) return;
                    setToastErr(null); setToastMsg(null);
                    startToast(async () => {
                      const res = await disconnectToast(c.restaurantGuid);
                      if (res.error) setToastErr(res.error);
                    });
                  }}
                  className="text-[12.5px] font-semibold text-muted-2 hover:text-danger disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
        {toastMsg && <p className="text-sm text-[#15803D] mt-3">{toastMsg}</p>}
        {toastErr && <p className="text-sm text-danger mt-3">{toastErr}</p>}
      </div>
    </div>
  );
}
