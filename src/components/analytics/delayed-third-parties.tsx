"use client";

import { useEffect, useState } from "react";
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";

const INTERACTION_EVENTS = ["scroll", "mousemove", "keydown", "touchstart", "click"] as const;
const FALLBACK_DELAY_MS = 5000;

// GTM/GA cost real Lighthouse points (main-thread work, unused JS from GTM's
// container script) even though they don't block first paint. Deferring them
// until the visitor actually interacts — or a short timeout, for readers who
// never move the mouse — keeps that cost off the critical initial load
// without losing analytics for anyone who spends real time on the page.
export function DelayedThirdParties({ gtmId, gaId }: { gtmId: string; gaId: string | null }) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    const load = () => setShouldLoad(true);
    const timeout = window.setTimeout(load, FALLBACK_DELAY_MS);

    INTERACTION_EVENTS.forEach((event) => window.addEventListener(event, load, { once: true, passive: true }));

    return () => {
      window.clearTimeout(timeout);
      INTERACTION_EVENTS.forEach((event) => window.removeEventListener(event, load));
    };
  }, [shouldLoad]);

  if (!shouldLoad) return null;

  return (
    <>
      <GoogleTagManager gtmId={gtmId} />
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </>
  );
}
