"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// A card whose body collapses behind a header row. Used for setup-heavy sections
// (interview criteria, screening questions) that are built once and rarely
// revisited, so they don't crowd out the day-to-day view. Body stays mounted
// (hidden via CSS) so any inner state survives collapse/expand.
export function CollapsibleSection({
  title,
  subtitle,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-line rounded-2xl shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
            {typeof count === "number" && count > 0 && (
              <span className="text-[12px] font-semibold text-muted-2 bg-paper border border-line rounded-full px-2 py-0.5 tabular-nums">{count}</span>
            )}
          </div>
          {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-2">
          {open ? "Hide" : "Show"}
          <ChevronDown size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className={open ? "px-5 pb-5 -mt-1" : "hidden"}>{children}</div>
    </div>
  );
}
