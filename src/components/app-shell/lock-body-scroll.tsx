"use client";

import { useEffect } from "react";

// The app shell is `position: fixed; inset: 0` and scrolls its own inner
// #app-scroll container. But the DOCUMENT itself was never height-locked (only
// overflow-x was hidden globally), so on iOS — WKWebView with contentInset
// "always" + viewport-fit=cover — the body could still scroll or rubber-band.
// When it did, the whole fixed shell shifted: the sticky location bar + menu got
// pushed up out of view (the recurring "location switcher vanishes on Hiring"
// report) and dead white space appeared below that you couldn't scroll past.
//
// We can't lock html/body globally — the marketing, careers, apply, and login
// pages use normal document scroll and would break. So we lock it ONLY while the
// authenticated app shell is mounted, and restore the previous styles on unmount
// (navigating out to a public page). The inner #app-scroll stays the sole
// scroller. Renders nothing.
export function LockBodyScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);
  return null;
}
