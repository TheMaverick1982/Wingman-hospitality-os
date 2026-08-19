"use client";

import { useLocationParam } from "./use-location-param";

export type LocationStat = { id: string; name: string; repeatRate: number };

// The footer stat card. It mirrors the top-bar location switcher, which stores
// the selected location in the `?location=` URL param — so this reads the same
// param and shows the matching location's name and repeat rate. When nothing is
// selected (the "All locations" default, or a single-location member), it falls
// back to the label/rate the server computed.
export function SidebarLocationStat({
  stats,
  fallbackName,
  fallbackRate,
}: {
  stats: LocationStat[];
  fallbackName: string;
  fallbackRate: number;
}) {
  const param = useLocationParam();
  const match = param && param !== "all" ? stats.find((s) => s.id === param) : null;
  const name = match ? match.name : fallbackName;
  const rate = match ? match.repeatRate : fallbackRate;

  return (
    <div className="bg-paper rounded-[14px] p-4 mb-3">
      <div className="text-[13px] font-semibold text-ink mb-1 truncate">{name}</div>
      <div className="text-xs text-muted mb-3">{rate}% repeat rate this month</div>
      <div className="h-1.5 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full bg-brick" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}
