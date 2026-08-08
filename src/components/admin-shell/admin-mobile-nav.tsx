"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { AdminSidebar } from "./admin-sidebar";

// Mobile-only top bar with a hamburger that opens the admin sidebar as a slide-in
// drawer. Hidden at lg+ where the fixed sidebar takes over. Mirrors the customer
// app's MobileNav.
export function AdminMobileNav({ fullName, platformAccess }: { fullName: string; platformAccess: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-line px-5 min-h-14"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="p-1 -ml-1 text-ink">
          <Menu size={24} />
        </button>
        <WingmanLogo className="h-5 w-auto" />
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-brick">Admin</span>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          {/* Tapping any nav link closes the drawer (event delegation). */}
          <div
            className="absolute left-0 top-0 h-full w-[248px] shadow-xl"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 text-muted-2 hover:text-ink"
            >
              <X size={20} />
            </button>
            <AdminSidebar variant="drawer" fullName={fullName} platformAccess={platformAccess} />
          </div>
        </div>
      )}
    </>
  );
}
