"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Force the app content area (and window) to the top on first load and on every
// route change. Some pages (e.g. the dashboard) otherwise mount already scrolled
// down — which on mobile hides the sticky nav header. Runs after paint so it wins
// over any autofocus/scroll-into-view that nudged the position.
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
    return () => cancelAnimationFrame(raf);
  }, [pathname, targetId]);
  return null;
}
