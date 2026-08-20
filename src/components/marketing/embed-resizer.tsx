"use client";

import { useEffect } from "react";

// Posts this document's height up to the parent window so an embedding <iframe>
// can size itself to fit (no inner scrollbar) — the parent can't measure a
// cross-origin frame. Each embeddable tool passes a DISTINCT messageKey so a
// host page embedding two Wingman tools resizes each to its own height. Content
// height changes as results/forms update, so re-measure aggressively but only
// post on an actual change. Rendered only in embed mode.
export function EmbedResizer({ messageKey }: { messageKey: string }) {
  useEffect(() => {
    let last = 0;
    const post = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      if (h > 0 && h !== last) {
        last = h;
        window.parent?.postMessage({ [messageKey]: h }, "*");
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
  }, [messageKey]);
  return null;
}
