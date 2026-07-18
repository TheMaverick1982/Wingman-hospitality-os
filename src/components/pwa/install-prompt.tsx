"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, X } from "lucide-react";

// Nudges mobile web users to install Wingman to their home screen — a custom
// "Install" button on Android/Chrome (via beforeinstallprompt) and a Share →
// Add to Home Screen hint on iOS Safari (which has no prompt event). Only shows
// inside the app (not marketing), on mobile, when not already installed, and
// stays dismissed once closed.
const APP_PREFIXES = ["/dashboard", "/training", "/accountability", "/culture", "/hiring", "/reporting", "/staff", "/settings", "/start-here", "/wizard", "/support", "/recovery", "/growth", "/journey", "/menu", "/bounceback"];
const DISMISS_KEY = "wm-install-dismissed";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [hidden, setHidden] = useState(true); // hidden until we confirm eligibility client-side

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Defer the client-only eligibility read out of the synchronous effect body.
    const raf = requestAnimationFrame(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ua = navigator.userAgent || "";
      const ios = /iPad|iPhone|iPod/.test(ua);
      const mobile = ios || /Android/i.test(ua);
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      setIsIOS(ios);
      setHidden(standalone || dismissed || !mobile);
    });

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stash it; show our own button
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const onAppRoute = !!pathname && APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Show only when eligible, on an app route, and we actually have something to offer.
  if (hidden || !onAppRoute || (!deferred && !isIOS)) return null;

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="fixed bottom-4 inset-x-4 z-[55] rounded-xl bg-white border border-line shadow-lg px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">Add Wingman to your home screen</p>
        {isIOS ? (
          <p className="text-[13px] text-muted leading-[1.4] mt-0.5 inline-flex items-center gap-1 flex-wrap">
            Tap <Share size={13} className="inline" /> Share, then &ldquo;Add to Home Screen.&rdquo;
          </p>
        ) : (
          <p className="text-[13px] text-muted mt-0.5">Open it like an app — faster, and it works offline.</p>
        )}
      </div>
      {!isIOS && deferred && (
        <button onClick={install} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-3.5 py-2 hover:bg-brick-dark transition-colors whitespace-nowrap">
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="text-muted-2 hover:text-ink transition-colors shrink-0">
        <X size={18} />
      </button>
    </div>
  );
}
