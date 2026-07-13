"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Heart,
  RotateCcw,
  Receipt,
  GraduationCap,
  Footprints,
  AlertTriangle,
  Briefcase,
  Users,
  TrendingUp,
  ClipboardCheck,
  UtensilsCrossed,
  Wand2,
  BarChart3,
  Settings,
  ShieldCheck,
  Rocket,
  HelpCircle,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { getSectionAccess, ROLE_LABELS, type AccessRole, type Section, type PermissionOverrides } from "@/lib/auth/permissions";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { SidebarLocationStat, type LocationStat } from "./sidebar-location-stat";

const NAV: { href: string; label: string; icon: LucideIcon; section: Section }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, section: "dashboard" },
  { href: "/culture", label: "Culture", icon: Heart, section: "culture" },
  { href: "/bounceback", label: "Guest Bounce Back", icon: RotateCcw, section: "bounceback" },
  { href: "/recovery", label: "Service Recovery", icon: Receipt, section: "recovery" },
  { href: "/training", label: "Training & Standards", icon: GraduationCap, section: "training" },
  { href: "/journey", label: "Guest Journey", icon: Footprints, section: "journey" },
  { href: "/accountability", label: "Accountability", icon: AlertTriangle, section: "accountability" },
  { href: "/hiring", label: "Hiring", icon: Briefcase, section: "hiring" },
  { href: "/growth", label: "Revenue Growth Planner", icon: TrendingUp, section: "growth" },
  { href: "/menu", label: "Menu Engineering", icon: UtensilsCrossed, section: "menu" },
  { href: "/audit", label: "Standout Audit", icon: ClipboardCheck, section: "audit" },
  { href: "/reporting", label: "Reporting", icon: BarChart3, section: "reporting" },
  { href: "/staff", label: "Staff", icon: Users, section: "staff" },
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
  locationStats,
  fallbackLocationName,
  fallbackRepeatRate,
  isPlatformAdmin,
  permissionOverrides,
  showStartHere,
  variant = "desktop",
}: {
  accessRole: AccessRole;
  fullName: string;
  locationStats: LocationStat[];
  fallbackLocationName: string;
  fallbackRepeatRate: number;
  isPlatformAdmin?: boolean;
  permissionOverrides?: PermissionOverrides;
  showStartHere?: boolean;
  variant?: "desktop" | "drawer";
}) {
  const pathname = usePathname();
  const isSuperAdmin = accessRole === "super_admin";

  // Desktop: a fixed sticky column, hidden on small screens (a mobile drawer
  // renders the same nav via variant="drawer").
  const rootClass =
    variant === "drawer"
      ? "w-[248px] bg-white py-5 px-4 flex flex-col h-full overflow-y-auto"
      : "hidden lg:flex w-[248px] shrink-0 bg-white border-r border-line py-5 px-4 flex-col sticky top-0 h-screen";

  return (
    <div className={rootClass} data-tour="nav">
      <Link href="/dashboard" aria-label="Wingman home" className="flex items-center px-2.5 pb-6">
        <WingmanLogo className="h-6 w-auto" />
      </Link>

      <nav className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto">
        {showStartHere && (
          <Link
            href="/start-here"
            className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors mb-1 ${
              pathname.startsWith("/start-here") ? "bg-brick text-white font-semibold" : "text-brick-dark bg-brick-tint font-semibold hover:brightness-95"
            }`}
          >
            <Rocket size={19} strokeWidth={2} className={pathname.startsWith("/start-here") ? "text-white/90" : "text-brick"} />
            Start here
          </Link>
        )}
        {NAV.filter((item) => getSectionAccess(accessRole, item.section, permissionOverrides) !== "none").map((item) => {
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

        <Link
          href="/help"
          className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
            pathname.startsWith("/help")
              ? "bg-brick text-white font-semibold"
              : "text-charcoal-2 font-medium hover:bg-paper"
          }`}
        >
          <HelpCircle size={19} strokeWidth={2} className={pathname.startsWith("/help") ? "text-white/90" : "text-muted-2"} />
          Help
        </Link>

        <Link
          href="/features"
          className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
            pathname.startsWith("/features")
              ? "bg-brick text-white font-semibold"
              : "text-charcoal-2 font-medium hover:bg-paper"
          }`}
        >
          <Lightbulb size={19} strokeWidth={2} className={pathname.startsWith("/features") ? "text-white/90" : "text-muted-2"} />
          Feature ideas
        </Link>

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

      <div className="mt-auto shrink-0 pt-3">
        {isPlatformAdmin && (
          <Link
            href="/admin/organizations"
            className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm font-medium text-charcoal-2 hover:bg-paper transition-colors mb-3"
          >
            <ShieldCheck size={19} strokeWidth={2} className="text-muted-2" />
            Platform admin
          </Link>
        )}
        <SidebarLocationStat stats={locationStats} fallbackName={fallbackLocationName} fallbackRate={fallbackRepeatRate} />
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
