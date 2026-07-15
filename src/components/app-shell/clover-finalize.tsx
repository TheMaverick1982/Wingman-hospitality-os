"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { finalizeCloverInstall } from "@/app/(app)/settings/clover-actions";

// Renders only when a `clover_pending` cookie is present (an App-Market install
// waiting to be linked). On mount it finalizes the link to the signed-in owner's
// org and shows a confirmation. Cookie-driven, so it catches the merchant on
// whatever page they land after signing in or creating their account.
export function CloverFinalize() {
  const ran = useRef(false);
  const [state, setState] = useState<"working" | "done" | "owner" | "hidden">("working");
  const [merchant, setMerchant] = useState<string>("");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const res = await finalizeCloverInstall();
      if (res.ok) {
        setMerchant(res.merchantName || "your Clover store");
        setState("done");
      } else if (res.needsOwner) {
        setState("owner");
      } else {
        setState("hidden");
      }
    })();
  }, []);

  if (state === "hidden" || state === "working") return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,460px)] rounded-xl border border-line bg-white shadow-lg px-4 py-3 flex items-start gap-3">
      {state === "done" ? (
        <>
          <span className="w-7 h-7 rounded-full bg-[#E7F6EC] text-[#15803D] flex items-center justify-center shrink-0">
            <Check size={15} />
          </span>
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-ink">Clover store connected</div>
            <div className="text-muted-2">
              {merchant} is now syncing into Wingman.{" "}
              <Link href="/settings?tab=api" className="font-semibold text-brick hover:underline">
                View in Settings
              </Link>
            </div>
          </div>
        </>
      ) : (
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-ink">Finish connecting Clover</div>
          <div className="text-muted-2">
            Your Clover store is ready to link, but only the <span className="font-semibold">account owner</span> can
            finish it. Ask your owner to sign in to complete the connection.
          </div>
        </div>
      )}
      <button type="button" onClick={() => setState("hidden")} className="ml-auto text-muted-2 hover:text-ink shrink-0" aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  );
}
