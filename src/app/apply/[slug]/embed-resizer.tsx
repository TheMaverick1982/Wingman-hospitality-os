"use client";

import { useEffect } from "react";

// When the application form is embedded (?embed=1) in a third-party page, the
// parent's <iframe> can't measure our content across origins. So we post our
// content height up to the parent, which the embed snippet uses to size the
// iframe to fit exactly — no inner scrollbar, form shown in full.
//
// The form grows dynamically (screening questions appear after a role is picked,
// validation messages, custom fields), so we re-measure aggressively: a
// ResizeObserver on <body>, a MutationObserver for added/removed nodes, load /
// resize events, and a short polling interval as a catch-all. We only post when
// the height actually changes, so it stays cheap. Rendered only in embed mode.
export function EmbedResizer() {
  useEffect(() => {
    let last = 0;
    const post = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      if (h > 0 && h !== last) {
        last = h;
        window.parent?.postMessage({ wingmanApplyHeight: h }, "*");
      }
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    const mo = new MutationObserver(post);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("load", post);
    window.addEventListener("resize", post);
    // Catch-all for anything the observers miss (async layout, fonts, images).
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
