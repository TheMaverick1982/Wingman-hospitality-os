"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMomentReaction } from "./actions";

// Celebrate toggle for a win. Optimistic so the tap feels instant, then refreshes
// so counts stay in sync across viewers.
export function WinCelebrate({
  momentId,
  initialCount,
  initialReacted,
}: {
  momentId: string;
  initialCount: number;
  initialReacted: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);
  const [, start] = useTransition();

  function toggle() {
    const next = !reacted;
    setReacted(next);
    setCount((c) => c + (next ? 1 : -1));
    start(async () => {
      const res = await toggleMomentReaction(momentId);
      if (res.error) {
        // revert on failure
        setReacted(!next);
        setCount((c) => c + (next ? -1 : 1));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={reacted}
      className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${
        reacted ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-muted-2 hover:border-brick hover:text-brick"
      }`}
    >
      <span aria-hidden>🎉</span>
      <span>Celebrate{count > 0 ? ` · ${count}` : ""}</span>
    </button>
  );
}
