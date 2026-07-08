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
  TrendingUp,
  Wand2,
  BarChart3,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getSectionAccess, ROLE_LABELS, type AccessRole, type Section } from "@/lib/auth/permissions";
import { WingmanLogo } from "@/components/ui/wingman-logo";

const NAV: { href: string; label: string; icon: LucideIcon; section: Section }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, section: "dashboard" },
  { href: "/culture", label: "Culture", icon: Heart, section: "culture" },
  { href: "/bounceback", label: "Guest Bounce Back", icon: RotateCcw, section: "bounceback" },
  { href: "/recovery", label: "Service Recovery", icon: Receipt, section: "recovery" },
  { href: "/training", label: "Training & Standards", icon: GraduationCap, section: "training" },
  { href: "/accountability", label: "Accountability", icon: AlertTriangle, section: "accountability" },
  { href: "/hiring", label: "Hiring", icon: Briefcase, section: "hiring" },
  { href: "/growth", label: "Revenue Growth Planner", icon: TrendingUp, section: "growth" },
  { href: "/reporting", label: "Reporting", icon: BarChart3, section: "reporting" },
];

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Sidebar({
  accessRole,
  fullName,
  locationName,
  repeatRate,
  isPlatformAdmin,
}: {
  accessRole: AccessRole;
  fullName: string;
  locationName: string;
  repeatRate: number;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isSuperAdmin = accessRole === "super_admin";

  return (
    <div className="w-[248px] shrink-0 bg-white border-r border-line py-5 px-4 flex flex-col sticky top-0 h-screen">
      <Link href="/dashboard" aria-label="Wingman home" className="flex items-center px-2.5 pb-6">
        <WingmanLogo className="h-6 w-auto" />
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.filter((item) => getSectionAccess(accessRole, item.section) !== "none").map((item) => {
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

        {isSuperAdmin && (
          <Link
            href="/wizard"
            className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
              pathname.startsWith("/wizard")
                ? "bg-brick text-white font-semibold"
                : "text-charcoal-2 font-medium hover:bg-paper"
            }`}
          >
            <Wand2 size={19} strokeWidth={2} className={pathname.startsWith("/wizard") ? "text-white/90" : "text-muted-2"} />
            Setup wizard
          </Link>
        )}

        {isSuperAdmin && (
          <>
            <div className="h-px bg-line my-2 mx-2" />
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
                pathname.startsWith("/settings")
                  ? "bg-brick text-white font-semibold"
                  : "text-charcoal-2 font-medium hover:bg-paper"
              }`}
            >
              <Settings size={19} strokeWidth={2} className={pathname.startsWith("/settings") ? "text-white/90" : "text-muted-2"} />
              Settings
            </Link>
          </>
        )}
      </nav>

      <div className="mt-auto">
        {isPlatformAdmin && (
          <Link
            href="/admin/organizations"
            className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm font-medium text-charcoal-2 hover:bg-paper transition-colors mb-3"
          >
            <ShieldCheck size={19} strokeWidth={2} className="text-muted-2" />
            Platform admin
          </Link>
        )}
        <div className="bg-paper rounded-[14px] p-4 mb-3">
          <div className="text-[13px] font-semibold text-ink mb-1 truncate">{locationName}</div>
          <div className="text-xs text-muted mb-3">{repeatRate}% repeat rate this month</div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full rounded-full bg-brick" style={{ width: `${Math.min(repeatRate, 100)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-2.5 py-2 border-t border-line">
          <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center shrink-0 text-[13px] font-semibold">
            {initialsOf(fullName)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-semibold text-ink truncate">{fullName || "You"}</div>
            <div className="text-xs text-muted-2 truncate">{ROLE_LABELS[accessRole]}</div>
          </div>
          <span className="text-muted-2 text-sm">⌄</span>
        </div>
      </div>
    </div>
  );
}
