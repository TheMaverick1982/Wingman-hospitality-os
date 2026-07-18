"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Registers the service worker and surfaces a controlled "new version" prompt.
// We never auto-skipWaiting — a waiting worker sits until the user taps Refresh,
// which messages SKIP_WAITING; the resulting controllerchange reloads the page.
export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            // A new worker finished installing while an old one controls the page.
            if (next.state === "installed" && navigator.serviceWorker.controller) setWaiting(next);
          });
        });
      })
      .catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-[320px] z-[60] rounded-xl bg-ink text-white shadow-lg px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-sm">A new version of Wingman is ready.</span>
      <button
        onClick={() => waiting.postMessage("SKIP_WAITING")}
        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 transition-colors rounded-lg px-3 py-1.5 whitespace-nowrap"
      >
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  );
}
