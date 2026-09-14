"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Force the app content area (and window) to the top on first load and on every
// route change. Some pages (e.g. the dashboard) otherwise mount already scrolled
// down — which on mobile hides the sticky nav header. Runs after paint so it wins
// over any autofocus/scroll-into-view that nudged the position.
//
// It ALSO re-pins on a location switch. Picking a location changes only the
// `?location=` search param (same pathname), so a plain route-change effect never
// fires for it — and on the iOS app the native <select> picker + contentInset can
// leave the fixed shell drifted, so the sticky top bar (with the switcher itself)
// ends up scrolled out of view and "vanishes" until a refresh. The switcher
// dispatches a `wm:location` event on every change (see use-location-param.ts);
// we listen for it and snap window + content back to the top so the bar is always
// visible right after you switch. This is the durable cure for the long-running
// "location switcher disappears after I pick a location" report.
export function ScrollReset({ targetId }: { targetId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const reset = () => {
      const el = document.getElementById(targetId);
      if (el) el.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    reset();
    // A second pass on the next frame beats late focus/layout shifts.
    const raf = requestAnimationFrame(reset);
    // Re-pin after a location switch (a same-path search-param change).
    const onLocation = () => {
      reset();
      requestAnimationFrame(reset);
    };
    window.addEventListener("wm:location", onLocation);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wm:location", onLocation);
    };
  }, [pathname, targetId]);
  return null;
}
