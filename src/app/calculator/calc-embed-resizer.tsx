"use client";

import { useEffect } from "react";

// When the calculator is embedded (?embed=1) on a third-party page, the parent
// <iframe> can't measure our height across origins. Post it up so the embed
// snippet can size the frame to fit — no inner scrollbar. The calculator's
// height changes as the result/lead form updates, so re-measure aggressively but
// only post on an actual change. Rendered only in embed mode.
export function CalcEmbedResizer() {
  useEffect(() => {
    let last = 0;
    const post = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      if (h > 0 && h !== last) {
        last = h;
        window.parent?.postMessage({ wingmanCalcHeight: h }, "*");
      }
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    const mo = new MutationObserver(post);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("load", post);
    window.addEventListener("resize", post);
    const iv = setInterval(post, 400);
    return () => {
      ro.disconnect();
      mo.disconnect();
      clearInterval(iv);
      window.removeEventListener("load", post);
      window.removeEventListener("resize", post);
    };
  }, []);
  return null;
}
