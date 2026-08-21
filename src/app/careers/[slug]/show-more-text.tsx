"use client";

import { useEffect, useRef, useState } from "react";

// The job ad on a careers card, clamped to a few lines with a Show more / Show
// less toggle. The toggle only appears when the text actually overflows the
// clamp (measured), so short ads don't get a pointless "Show more".
export function ShowMoreText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 2);
  }, [text]);

  return (
    <div className="mt-2.5">
      <p
        ref={ref}
        className={`text-[14px] text-muted leading-relaxed whitespace-pre-line ${open ? "" : "line-clamp-3"}`}
      >
        {text}
      </p>
      {(overflowing || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[13px] font-semibold text-brick hover:text-brick-dark mt-1.5"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
