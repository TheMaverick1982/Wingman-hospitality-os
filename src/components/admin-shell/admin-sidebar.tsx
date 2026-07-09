"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, BarChart3, CreditCard, LineChart, LifeBuoy, ArrowLeft, type LucideIcon } from "lucide-react";
import { WingmanLogo } from "@/components/ui/wingman-logo";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/reporting", label: "Reporting", icon: BarChart3 },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart },
];

export function AdminSidebar({ fullName }: { fullName: string }) {
  const pathname = usePathname();

  return (
    <div className="w-[248px] shrink-0 bg-white border-r border-line py-5 px-4 flex flex-col sticky top-0 h-screen">
      <div className="flex items-center px-2.5 pb-1">
        <WingmanLogo className="h-6 w-auto" />
      </div>
      <div className="px-2.5 pb-6">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-brick">Platform Admin</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
                active ? "bg-brick text-white font-semibold" : "text-charcoal-2 font-medium hover:bg-paper"
              }`}
            >
              <item.icon size={19} strokeWidth={2} className={active ? "text-white/90" : "text-muted-2"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-[10px] rounded-[10px] text-sm font-medium text-charcoal-2 hover:bg-paper transition-colors mb-3"
        >
          <ArrowLeft size={17} strokeWidth={2} className="text-muted-2" />
          Back to app
        </Link>
        <div className="flex items-center gap-2.5 px-2.5 py-2 border-t border-line">
          <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center shrink-0 text-[13px] font-semibold">
            {fullName.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-semibold text-ink truncate">{fullName || "You"}</div>
            <div className="text-xs text-muted-2 truncate">Platform Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
