"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/crm", label: "Pipeline" },
  { href: "/admin/crm/automations", label: "Automations" },
  { href: "/admin/crm/broadcast", label: "Broadcast" },
];

export function CrmTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const active = t.href === "/admin/crm" ? pathname === "/admin/crm" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${
              active ? "border-brick text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
