"use client";

import { useEffect } from "react";

// When the application form is embedded (?embed=1) in a third-party page, the
// parent's <iframe> can't measure our content across origins. So we post our
// content height up to the parent, which the embed snippet uses to size the
// iframe to fit exactly — no inner scrollbar, form shown in full. Rendered only
// in embed mode.
export function EmbedResizer() {
  useEffect(() => {
    const post = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      window.parent?.postMessage({ wingmanApplyHeight: h }, "*");
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    window.addEventListener("load", post);
    window.addEventListener("resize", post);
    // Re-post after fonts/images settle and after form interactions expand it.
    const timers = [setTimeout(post, 300), setTimeout(post, 1200)];
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
      window.removeEventListener("resize", post);
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
