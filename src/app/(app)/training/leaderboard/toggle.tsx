"use client";

import { useState, useTransition } from "react";
import { setLeaderboardEnabled } from "./actions";

export function LeaderboardToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const r = await setLeaderboardEnabled(next);
      if (r.error) setOn(!next);
    });
  };
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={on}
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-brick" : "bg-line"} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
      <span className="text-[13px] text-charcoal-2">{on ? "Leaderboard is on for your team" : "Leaderboard is hidden from staff"}</span>
    </div>
  );
}
