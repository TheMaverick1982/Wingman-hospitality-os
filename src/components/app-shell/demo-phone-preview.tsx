"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Smartphone, X } from "lucide-react";
import { useIsFramed } from "@/lib/use-is-framed";

// Demo-only "Phone view": pops the LIVE app up inside a phone frame at mobile
// width, so a rep can show a prospect how the mobile experience actually looks
// and feels — the real thing, tappable, not a mockup. The iframe is same-origin
// (see next.config.ts frame-ancestors 'self') and carries the same demo session,
// so it mirrors whatever role the rep is currently showing.
export function DemoPhonePreview() {
  const framed = useIsFramed();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Never render inside the preview itself (avoids a phone-in-a-phone button).
  if (framed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full bg-white/15 hover:bg-white/25 px-3 py-1 font-semibold transition-colors"
      >
        <Smartphone size={14} /> Phone view
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Wingman on a phone"
        >
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center text-white max-w-sm px-2">
              <div className="text-lg font-bold tracking-[-0.01em]">The same Wingman, in their pocket</div>
              <div className="text-sm text-white/70 mt-0.5">Exactly what your team sees on their phone — go ahead and tap around.</div>
            </div>

            {/* Phone frame */}
            <div
              className="relative rounded-[2.6rem] border-[10px] border-[#0a0a0a] bg-[#0a0a0a] shadow-2xl overflow-hidden"
              style={{ width: 375, height: "min(760px, 76vh)" }}
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[26px] w-32 rounded-b-[14px] bg-[#0a0a0a] z-10" />
              <iframe
                src={pathname || "/dashboard"}
                title="Wingman on a phone"
                className="w-full h-full rounded-[2rem] bg-white border-0"
              />
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-white text-sm font-semibold"
            >
              <X size={16} /> Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
