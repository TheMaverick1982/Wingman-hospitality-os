"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { WingmanLogo } from "@/components/ui/wingman-logo";

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/72 backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-[#ededed]">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between px-6 sm:px-10 h-[60px]">
        <Link href="/" aria-label="Wingman home" className="flex items-center">
          <WingmanLogo className="h-6 w-auto" />
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/how-it-works" className="text-sm font-medium text-ink hidden sm:inline">
            How it works
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-ink hidden sm:inline">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-medium text-[#525252] hidden sm:inline">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-ink rounded-full px-[18px] py-[9px] hover:bg-black transition-colors"
          >
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="sm:hidden flex items-center justify-center w-8 h-8 text-ink shrink-0"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </div>
      {open && (
        <div className="sm:hidden border-t border-[#ededed] bg-white px-6 py-3 flex flex-col">
          <Link
            href="/how-it-works"
            onClick={() => setOpen(false)}
            className="text-[15px] font-medium text-ink py-3 border-b border-[#f1f1f1]"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="text-[15px] font-medium text-ink py-3 border-b border-[#f1f1f1]"
          >
            Pricing
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="text-[15px] font-medium text-[#525252] py-3">
            Log in
          </Link>
        </div>
      )}
    </header>
  );
}
