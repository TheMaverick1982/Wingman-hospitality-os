"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GuestTab } from "@/lib/guest-tabs";

// The tab strip shown at the top of every Guests page (Bounce Back, Reviews,
// Service Recovery, Journey) so the four read as one surface. Horizontally
// scrollable on phones so it never overflows the screen.
export function GuestNavTabs({ tabs }: { tabs: GuestTab[] }) {
  const pathname = usePathname();
  if (tabs.length < 2) return null; // nothing to switch between

  return (
    <div className="-mx-5 sm:mx-0 px-5 sm:px-0">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-line pb-px">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap text-sm font-semibold px-3.5 py-2.5 rounded-t-lg border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brick text-brick"
                  : "border-transparent text-charcoal-2 hover:text-ink hover:border-line-strong"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
