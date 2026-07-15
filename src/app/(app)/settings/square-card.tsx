"use client";

import { useState, useTransition } from "react";
import { PlugZap, RefreshCw, Check } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { disconnectSquare, syncSquareNow, connectSquareSandboxToken } from "./square-actions";

export type SquareConnection = {
  merchantId: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncGuests: number;
  lastSyncSalesCents: number;
};

function fmt(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// Direct POS integrations. Square today; Clover / Toast / Global Payments will
// appear here as more rows as each connector ships.
export function DirectIntegrations({ configured, connection, sandboxTokenAvailable }: { configured: boolean; connection: SquareConnection | null; sandboxTokenAvailable?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Direct integrations</div>
      <p className="text-sm text-muted mb-5">
        Connect your POS to sync automatically — no API key or Zapier needed. More platforms coming soon.
      </p>

      <div className="rounded-xl border border-line p-4">
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
              <span className="text-xs text-muted-2">Setup pending</span>
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
    </div>
  );
}
