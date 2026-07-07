"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function GreetingHeader({ firstName, greetingLocation }: { firstName: string; greetingLocation: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // The server has no idea what timezone the visitor is in, so the
    // greeting/date/time are deliberately blank until mount, then filled in
    // from the browser's own clock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);

  const greeting = now ? greetingForHour(now.getHours()) : "Welcome back";
  const dateLabel = now ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";
  const timeLabel = now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">
          {greeting}, {firstName}
        </h1>
        <p className="text-base text-muted">Here&apos;s how {greetingLocation} is holding the standard today.</p>
      </div>
      <div className="text-sm text-muted-2 font-medium whitespace-nowrap">
        {dateLabel} {dateLabel && timeLabel ? "·" : ""} {timeLabel}
      </div>
    </div>
  );
}
