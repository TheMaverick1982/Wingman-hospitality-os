"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Heart,
  RotateCcw,
  Receipt,
  GraduationCap,
  AlertTriangle,
  Briefcase,
  Wand2,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { getSectionAccess, ROLE_LABELS, type AccessRole, type Section } from "@/lib/auth/permissions";

const NAV: { href: string; label: string; icon: LucideIcon; section: Section }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, section: "dashboard" },
  { href: "/culture", label: "Culture", icon: Heart, section: "culture" },
  { href: "/bounceback", label: "Guest Bounce Back", icon: RotateCcw, section: "bounceback" },
  { href: "/recovery", label: "Service Recovery", icon: Receipt, section: "recovery" },
  { href: "/training", label: "Training & Standards", icon: GraduationCap, section: "training" },
  { href: "/accountability", label: "Accountability", icon: AlertTriangle, section: "accountability" },
  { href: "/hiring", label: "Hiring", icon: Briefcase, section: "hiring" },
  { href: "/reporting", label: "Reporting", icon: BarChart3, section: "reporting" },
];

export function Sidebar({
  orgName,
  accessRole,
  fullName,
}: {
  orgName: string;
  accessRole: AccessRole;
  fullName: string;
}) {
  const pathname = usePathname();
  const isSuperAdmin = accessRole === "super_admin";

  return (
    <div className="bg-[#fafafa] w-[240px] shrink-0 border-r border-line p-[14px] pt-5 flex flex-col">
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-[26px] h-[26px] rounded-lg bg-ink flex items-center justify-center shrink-0">
          <span className="text-white font-semibold text-xs">W</span>
        </div>
        <div className="min-w-0">
          <div className="text-ink font-semibold text-sm leading-tight truncate">Wingman</div>
          <div className="text-muted text-[11px] tracking-wide uppercase truncate">{orgName}</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.filter((item) => getSectionAccess(accessRole, item.section) !== "none").map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-sm transition-colors ${
                active
                  ? "bg-brick text-white font-semibold"
                  : "text-charcoal-2 font-medium hover:bg-[#efefef]"
              }`}
            >
              <item.icon size={16} strokeWidth={2} className={active ? "text-white" : "text-muted-2"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isSuperAdmin && (
        <div className="flex flex-col gap-1 mt-2">
          <Link
            href="/wizard"
            className="flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-sm font-medium text-charcoal-2 hover:bg-[#efefef] transition-colors"
          >
            <Wand2 size={16} className="text-muted-2" />
            Setup wizard
          </Link>
          <Link
            href="/settings"
            className={`flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-sm transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-brick text-white font-semibold"
                : "text-charcoal-2 font-medium hover:bg-[#efefef]"
            }`}
          >
            <Settings size={16} className={pathname.startsWith("/settings") ? "text-white" : "text-muted-2"} />
            Settings
          </Link>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-line flex items-center gap-2.5 px-2">
        <div className="w-[30px] h-[30px] rounded-full bg-ink flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold">{fullName.charAt(0).toUpperCase() || "?"}</span>
        </div>
        <div className="min-w-0">
          <div className="text-ink text-[13px] font-semibold truncate">{fullName || "You"}</div>
          <div className="text-muted-2 text-xs truncate">{ROLE_LABELS[accessRole]}</div>
        </div>
      </div>
    </div>
  );
}
