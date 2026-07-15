"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Check } from "lucide-react";
import { saveCardFromToken } from "./global-payments-actions";

// Pinned GlobalPayments.js version — the PCI-safe hosted-fields library. Card
// data is entered into GP-hosted iframes and never touches our page or servers;
// we only ever receive a single-use token. Override with NEXT_PUBLIC_GP_JS_URL
// if GP publishes a newer build.
const GP_JS_URL = process.env.NEXT_PUBLIC_GP_JS_URL || "https://js.globalpay.com/4.1.11/globalpayments.js";

type GpForm = { on: (event: string, cb: (detail: Record<string, unknown>) => void) => void };
type GpGlobal = {
  configure: (opts: { accessToken: string; apiVersion: string; env: string }) => void;
  ui: { form: (opts: Record<string, unknown>) => GpForm };
};

let scriptPromise: Promise<void> | null = null;
function loadGpScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { GlobalPayments?: GpGlobal }).GlobalPayments) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GP_JS_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the secure card library."));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Secure card entry backed by Global Payments hosted fields. Renders GP's iframe
// inputs, tokenizes on submit, and hands the single-use token to the server to
// store as the card on file. This is the production-safe path (no PAN ever
// reaches our servers) and also works in the sandbox.
export function GpHostedFields() {
  const router = useRouter();
  const setupRef = useRef(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (setupRef.current) return;
    setupRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/billing/gp-client-token");
        const data = (await res.json()) as { token?: string; env?: string; apiVersion?: string; error?: string };
        if (!res.ok || !data.token) throw new Error(data.error || "Could not start secure card entry.");
        await loadGpScript();
        if (cancelled) return;
        const GlobalPayments = (window as unknown as { GlobalPayments?: GpGlobal }).GlobalPayments;
        if (!GlobalPayments) throw new Error("Secure card library unavailable.");

        GlobalPayments.configure({ accessToken: data.token, apiVersion: data.apiVersion || "2021-03-22", env: data.env || "sandbox" });
        const form = GlobalPayments.ui.form({
          fields: {
            "card-number": { target: "#gp-card-number", placeholder: "•••• •••• •••• ••••" },
            "card-expiration": { target: "#gp-card-expiration", placeholder: "MM / YYYY" },
            "card-cvv": { target: "#gp-card-cvv", placeholder: "CVV" },
            submit: { target: "#gp-submit", value: "Save card" },
          },
          styles: {
            input: { "font-size": "15px", "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#1a1a1a", "padding": "10px 12px" },
            "input::placeholder": { color: "#9CA3AF" },
            "#secure-payment-field": { "box-sizing": "border-box" },
          },
        });

        form.on("ready", () => { if (!cancelled) setPhase("ready"); });
        form.on("token-success", async (detail) => {
          const ref = String(detail.paymentReference ?? detail.temporary_token ?? detail.token ?? "");
          if (!ref) { setError("Card entry didn't return a token — please try again."); setPhase("error"); return; }
          setPhase("saving");
          const r = await saveCardFromToken(ref);
          if (r.error) { setError(r.error); setPhase("error"); return; }
          setPhase("saved");
          router.refresh();
        });
        form.on("token-error", (detail) => {
          const reasons = (detail?.reasons as { message?: string }[] | undefined) ?? [];
          setError(reasons[0]?.message || "That card couldn't be verified. Check the details and try again.");
          setPhase("error");
        });
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : "Secure card entry failed to load."); setPhase("error"); }
      }
    })();

    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Lock size={14} className="text-olive" />
        <span className="text-[13px] font-semibold text-ink">Enter your card securely</span>
      </div>

      {phase === "loading" && (
        <div className="flex items-center gap-2 text-[13px] text-muted-2 py-3">
          <Loader2 size={14} className="animate-spin" /> Loading secure card fields…
        </div>
      )}

      {/* GP injects iframes into these targets. Kept mounted once setup begins. */}
      <div className={phase === "loading" ? "hidden" : "flex flex-col gap-2.5"}>
        <div>
          <label className="block text-[12px] font-semibold text-ink mb-1">Card number</label>
          <div id="gp-card-number" className="h-[42px] rounded-lg border border-line bg-white overflow-hidden" />
        </div>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-ink mb-1">Expiry</label>
            <div id="gp-card-expiration" className="h-[42px] rounded-lg border border-line bg-white overflow-hidden" />
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-ink mb-1">CVV</label>
            <div id="gp-card-cvv" className="h-[42px] rounded-lg border border-line bg-white overflow-hidden" />
          </div>
        </div>
        <div id="gp-submit" className="mt-1 [&_button]:w-full [&_button]:cursor-pointer [&_button]:rounded-lg [&_button]:bg-brick [&_button]:text-white [&_button]:text-sm [&_button]:font-semibold [&_button]:px-4 [&_button]:py-2.5 [&_button]:hover:opacity-90" />
      </div>

      {phase === "saving" && (
        <p className="text-[13px] text-muted-2 mt-2 inline-flex items-center gap-1.5">
          <Loader2 size={13} className="animate-spin" /> Saving your card…
        </p>
      )}
      {phase === "saved" && (
        <p className="text-[13px] text-olive mt-2 inline-flex items-center gap-1">
          <Check size={13} /> Card saved securely.
        </p>
      )}
      {error && <p className="text-[13px] text-danger mt-2">{error}</p>}

      <p className="text-[11.5px] text-muted-2 mt-3">
        Your card is entered directly with Global Payments — the numbers never touch Wingman&apos;s servers.
      </p>
    </div>
  );
}
