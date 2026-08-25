"use client";

import { useEffect, useState } from "react";
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
  Handshake,
  Wand2,
  BarChart3,
  Settings,
  ShieldCheck,
  Building2,
  Rocket,
  HelpCircle,
  Smartphone,
  Lightbulb,
  PlugZap,
  ChevronDown,
  MessageCircleQuestion,
  MessagesSquare,
  Star,
  Megaphone,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { getSectionAccess, ROLE_LABELS, type AccessRole, type Section, type PermissionOverrides } from "@/lib/auth/permissions";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { SidebarLocationStat, type LocationStat } from "./sidebar-location-stat";

type NavItem = { href: string; label: string; icon: LucideIcon; section: Section };

// Dashboard and Reporting are pinned on their own (top and bottom of the list);
// everything else is grouped so the desktop nav stays short and scroll-free.
const DASHBOARD_ITEM: NavItem = { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, section: "dashboard" };
const REPORTING_ITEM: NavItem = { href: "/reporting", label: "Reporting", icon: BarChart3, section: "reporting" };
// Guest Bounce Back is the most-used tool on the floor, so on mobile it's also
// surfaced as a one-tap shortcut above the Guests group (see below). It still
// lives inside Guests as its canonical home.
const BOUNCEBACK_ITEM: NavItem = { href: "/bounceback", label: "Guest Bounce Back", icon: RotateCcw, section: "bounceback" };

const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "guests",
    label: "Guests",
    items: [
      BOUNCEBACK_ITEM,
      { href: "/reviews", label: "Guest Reviews", icon: Star, section: "reviews" },
      { href: "/recovery", label: "Service Recovery", icon: Receipt, section: "recovery" },
      { href: "/journey", label: "Guest Journey", icon: Footprints, section: "journey" },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { href: "/shift", label: "Shift", icon: Megaphone, section: "shift" },
      { href: "/manager-channel", label: "Manager channel", icon: MessagesSquare, section: "manager_channel" },
      { href: "/culture", label: "Culture", icon: Heart, section: "culture" },
      { href: "/training", label: "Training & Standards", icon: GraduationCap, section: "training" },
      { href: "/accountability", label: "Accountability", icon: AlertTriangle, section: "accountability" },
      { href: "/hiring", label: "Hiring", icon: Briefcase, section: "hiring" },
      { href: "/staff", label: "Staff", icon: Users, section: "staff" },
      { href: "/questions", label: "Questions", icon: MessageCircleQuestion, section: "questions" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { href: "/growth", label: "Revenue Growth Planner", icon: TrendingUp, section: "growth" },
      { href: "/menu", label: "Menu Engineering", icon: UtensilsCrossed, section: "menu" },
      { href: "/audit", label: "Standout Audit", icon: ClipboardCheck, section: "audit" },
      { href: "/hospitality-score", label: "Hospitality Score", icon: Gauge, section: "reporting" },
      { href: "/partners", label: "Partners", icon: Handshake, section: "partners" },
    ],
  },
];

const NAV_STATE_KEY = "wm.nav.openGroups";

// Mobile only: the phone leads with the in-the-moment "on the floor" tools; the
// setup / analysis surfaces collapse into one "Set up & manage" group (they're
// really desktop work). Desktop keeps the full grouped nav unchanged. Ordered by
// href; anything the role can't see (or an unknown href) simply drops out.
const MOBILE_FLOOR_ORDER = [
  "/dashboard",
  "/shift",
  "/manager-channel",
  "/bounceback",
  "/recovery",
  "/reviews",
  "/culture",
  "/questions",
  "/accountability",
  "/training",
  // Hiring stays on the floor: managers review new applicants and run interviews
  // from their phone (building openings/criteria is still better on desktop).
  "/hiring",
  // Partners is a phone task too: managers snap a business card and log a touch
  // while they're out in the community (manager/owner-only by permission).
  "/partners",
];
const MOBILE_MANAGE_ORDER = ["/staff", "/journey", "/growth", "/menu", "/audit", "/hospitality-score", "/reporting"];
const ALL_NAV_ITEMS: NavItem[] = [DASHBOARD_ITEM, REPORTING_ITEM, ...NAV_GROUPS.flatMap((g) => g.items)];

// Items shown for a group in a given variant. On mobile, Guest Bounce Back is
// surfaced as a pinned shortcut above the Guests group, so it's removed from the
// group itself there — otherwise it would appear (and highlight) twice.
function groupItemsFor(group: { id: string; items: NavItem[] }, variant: "desktop" | "drawer"): NavItem[] {
  if (variant === "drawer" && group.id === "guests") {
    return group.items.filter((it) => it.href !== BOUNCEBACK_ITEM.href);
  }
  return group.items;
}

// The group whose section matches the current route (or null on Dashboard/
// Reporting). Uses the variant's visible items, so on mobile Bounce Back doesn't
// count toward — and needlessly auto-open — the Guests group.
function activeGroupId(pathname: string, variant: "desktop" | "drawer"): string | null {
  const g = NAV_GROUPS.find((grp) => groupItemsFor(grp, variant).some((it) => pathname.startsWith(it.href)));
  return g?.id ?? null;
}

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
  isFranchiseAdmin,
  permissionOverrides,
  showStartHere,
  questionsBadge = 0,
  variant = "desktop",
}: {
  accessRole: AccessRole;
  fullName: string;
  locationStats: LocationStat[];
  fallbackLocationName: string;
  fallbackRepeatRate: number;
  isPlatformAdmin?: boolean;
  isFranchiseAdmin?: boolean;
  permissionOverrides?: PermissionOverrides;
  showStartHere?: boolean;
  questionsBadge?: number;
  variant?: "desktop" | "drawer";
}) {
  const pathname = usePathname();
  const isSuperAdmin = accessRole === "super_admin";
  const isDeveloperRole = accessRole === "developer";
  const isStaff = accessRole === "staff";
  // Managers/shift leads reach Settings for the Notifications section (the page
  // itself hides the owner-only tabs from them).
  const canSeeSettings = accessRole === "super_admin" || accessRole === "manager" || accessRole === "shift_lead";

  const canSee = (section: Section) => getSectionAccess(accessRole, section, permissionOverrides) !== "none";

  // Mobile drawer for managers/owners: split into "on the floor" (flat, up top)
  // and a collapsed "Set up & manage" group. Staff already get a lean flat nav,
  // and desktop keeps its full grouped nav — so this only reshapes the phone.
  const isMobileZoned = variant === "drawer" && !isStaff;
  const [manageOpen, setManageOpen] = useState(false);
  const byHref = new Map(ALL_NAV_ITEMS.map((it) => [it.href, it] as const));
  const resolveNav = (hrefs: string[]): NavItem[] =>
    hrefs.map((h) => byHref.get(h)).filter((it): it is NavItem => !!it && canSee(it.section));
  const floorItems = isMobileZoned ? resolveNav(MOBILE_FLOOR_ORDER) : [];
  const manageItems = isMobileZoned ? resolveNav(MOBILE_MANAGE_ORDER) : [];

  // Collapsible nav groups. Start with only the group containing the current
  // page open — computed from the pathname so server and client render the same
  // markup — then load the visitor's saved open/closed choices on the client.
  // The active group is always forced open so the current page is never hidden.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.id === activeGroupId(pathname, variant)]))
  );
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_STATE_KEY) || "{}") as Record<string, boolean>;
      setOpenGroups((prev) => {
        const merged = { ...prev };
        for (const g of NAV_GROUPS) if (g.id in saved) merged[g.id] = saved[g.id];
        const active = activeGroupId(pathname, variant);
        if (active) merged[active] = true;
        return merged;
      });
    } catch {
      // ignore unreadable/blocked storage
    }
    // Load once on mount; the pathname effect below keeps the active group open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const active = activeGroupId(pathname, variant);
    if (active) setOpenGroups((prev) => (prev[active] ? prev : { ...prev, [active]: true }));
  }, [pathname, variant]);
  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(NAV_STATE_KEY, JSON.stringify(next));
      } catch {
        // ignore unwritable storage
      }
      return next;
    });
  };

  const navLink = (item: NavItem) => {
    const active = pathname.startsWith(item.href);
    const badge = item.href === "/questions" && questionsBadge > 0 ? questionsBadge : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
          active ? "bg-brick text-white font-semibold" : "text-charcoal-2 font-medium hover:bg-paper"
        }`}
      >
        <item.icon size={19} strokeWidth={2} className={active ? "text-white/90" : "text-muted-2"} />
        <span className="flex-1">{item.label}</span>
        {badge > 0 && (
          <span
            className={`shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
              active ? "bg-white/25 text-white" : "bg-brick text-white"
            }`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    );
  };

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
        {!isMobileZoned && canSee(DASHBOARD_ITEM.section) && navLink(DASHBOARD_ITEM)}

        {/* Mobile: pin Guest Bounce Back above the Guests group for one-tap
            access — it's the tool staff reach for constantly on the floor.
            (In the manager mobile split it lives in the "on the floor" list.) */}
        {variant === "drawer" && !isMobileZoned && canSee(BOUNCEBACK_ITEM.section) && (
          <div className="mt-1.5">{navLink(BOUNCEBACK_ITEM)}</div>
        )}

        {isStaff ? (
          // Staff see only a handful of sections — show them flat, no collapsible group headers.
          NAV_GROUPS.flatMap((group) => groupItemsFor(group, variant).filter((it) => canSee(it.section))).map((it) =>
            navLink(it)
          )
        ) : isMobileZoned ? (
          // Manager/owner on the phone: "on the floor" flat, then one collapsed
          // "Set up & manage" group for the desktop-first setup/analysis surfaces.
          <>
            {floorItems.map((it) => navLink(it))}
            {manageItems.length > 0 && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setManageOpen((o) => !o)}
                  aria-expanded={manageOpen}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2 hover:text-ink transition-colors"
                >
                  <span>Set up &amp; manage</span>
                  <ChevronDown size={14} className={`transition-transform duration-150 ${manageOpen ? "" : "-rotate-90"}`} />
                </button>
                {manageOpen && (
                  <div className="flex flex-col gap-0.5">
                    <div className="px-3 pb-1 text-[10.5px] text-muted-2 italic">Best on a computer</div>
                    {manageItems.map((it) => navLink(it))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          NAV_GROUPS.map((group) => {
            const items = groupItemsFor(group, variant).filter((it) => canSee(it.section));
            if (items.length === 0) return null; // hide a group the role can't see into
            const open = openGroups[group.id];
            const hasActive = items.some((it) => pathname.startsWith(it.href));
            return (
              <div key={group.id} className="mt-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2 hover:text-ink transition-colors"
                >
                  {/* Tint the label when its section holds the current page but is collapsed. */}
                  <span className={!open && hasActive ? "text-brick" : ""}>{group.label}</span>
                  <ChevronDown size={14} className={`transition-transform duration-150 ${open ? "" : "-rotate-90"}`} />
                </button>
                {open && <div className="flex flex-col gap-0.5">{items.map((it) => navLink(it))}</div>}
              </div>
            );
          })
        )}

        {!isMobileZoned && canSee(REPORTING_ITEM.section) && <div className="mt-1.5">{navLink(REPORTING_ITEM)}</div>}

        {/* Developer role: API-only. Its single home is the API access page. */}
        {isDeveloperRole && (
          <Link
            href="/api-access"
            className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm transition-colors ${
              pathname.startsWith("/api-access") ? "bg-brick text-white font-semibold" : "text-charcoal-2 font-medium hover:bg-paper"
            }`}
          >
            <PlugZap size={19} strokeWidth={2} className={pathname.startsWith("/api-access") ? "text-white/90" : "text-muted-2"} />
            API access
          </Link>
        )}

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

        {/* Opens in a new tab so it never pulls someone off their dashboard. */}
        <a
          href="/download"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm text-charcoal-2 font-medium hover:bg-paper transition-colors"
        >
          <Smartphone size={19} strokeWidth={2} className="text-muted-2" />
          Get the app
        </a>

        {accessRole !== "staff" && !isDeveloperRole && (
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
        )}

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

        {canSeeSettings && (
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
        {isFranchiseAdmin && (
          <Link
            href="/franchise"
            className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] text-sm font-medium text-charcoal-2 hover:bg-paper transition-colors mb-1"
          >
            <Building2 size={19} strokeWidth={2} className="text-muted-2" />
            Franchise oversight
          </Link>
        )}
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
