"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Heart,
  RotateCcw,
  GraduationCap,
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
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { getSectionAccess, ROLE_LABELS, type AccessRole, type Section, type PermissionOverrides } from "@/lib/auth/permissions";
import { accessibleGuestTabs } from "@/lib/guest-tabs";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { SidebarLocationStat, type LocationStat } from "./sidebar-location-stat";

type NavItem = { href: string; label: string; icon: LucideIcon; section: Section; tier: "core" | "more"; matchPrefixes?: string[] };

// A single, tiered nav model powers a calm default (progressive disclosure): the
// CORE sections a restaurant touches most are always visible; everything else
// lives behind one "More" expander, so a first-time owner sees ~7 destinations
// instead of ~19. The active page is never hidden — "More" auto-opens whenever
// the current page is a "more" section. Mobile keeps its own floor/manage split
// (below); staff get a flat, permission-filtered list. Order here is the display
// order within each tier.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, section: "dashboard", tier: "core" },
  // "Guests" is injected here at render time — it collapses the four guest tools
  // (Bounce Back, Reviews, Service Recovery, Journey) into one entry whose href
  // and visibility depend on which of those this person can access.
  { href: "/hiring", label: "Hiring", icon: Briefcase, section: "hiring", tier: "core" },
  { href: "/training", label: "Training & Standards", icon: GraduationCap, section: "training", tier: "core" },
  { href: "/accountability", label: "Accountability", icon: AlertTriangle, section: "accountability", tier: "core" },
  { href: "/staff", label: "Staff", icon: Users, section: "staff", tier: "core" },
  { href: "/culture", label: "Culture", icon: Heart, section: "culture", tier: "core" },
  // Everything below is tucked under "More" until the owner reaches for it.
  { href: "/shift", label: "Shift", icon: Megaphone, section: "shift", tier: "more" },
  { href: "/manager-channel", label: "Manager updates", icon: MessagesSquare, section: "manager_channel", tier: "more" },
  { href: "/questions", label: "Questions", icon: MessageCircleQuestion, section: "questions", tier: "more" },
  { href: "/growth", label: "Revenue Growth Planner", icon: TrendingUp, section: "growth", tier: "more" },
  { href: "/menu", label: "Menu Engineering", icon: UtensilsCrossed, section: "menu", tier: "more" },
  { href: "/audit", label: "Experience Audit", icon: ClipboardCheck, section: "audit", tier: "more" },
  { href: "/partners", label: "Partners", icon: Handshake, section: "partners", tier: "more" },
  { href: "/reporting", label: "Reporting", icon: BarChart3, section: "reporting", tier: "more" },
];

const MORE_STATE_KEY = "wm.nav.moreOpen";

// Mobile only: the phone leads with the in-the-moment "on the floor" tools; the
// setup / analysis surfaces collapse into one "Set up & manage" group (they're
// really desktop work). Ordered by href; anything the role can't see (or an
// unknown href) simply drops out.
const MOBILE_FLOOR_ORDER = [
  "/dashboard",
  "/shift",
  "/manager-channel",
  "/guests",
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
const MOBILE_MANAGE_ORDER = ["/staff", "/growth", "/menu", "/audit", "/reporting"];
const ALL_NAV_ITEMS: NavItem[] = NAV_ITEMS;

// Is the current route one of the "more" (collapsed) sections? Used to keep the
// More expander open whenever the active page lives inside it.
function isMoreActive(pathname: string): boolean {
  return NAV_ITEMS.some((it) => it.tier === "more" && pathname.startsWith(it.href));
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

  // The four guest tools collapse into one "Guests" entry. Its href is the first
  // tab this person can open; when only one is accessible we use that tool's full
  // name so the entry still self-describes (e.g. staff who only get Guest Journey).
  const guestTabs = accessibleGuestTabs(accessRole, permissionOverrides);
  const guestsItem: NavItem | null =
    guestTabs.length === 0
      ? null
      : {
          href: guestTabs[0].href,
          label: guestTabs.length > 1 ? "Guests" : guestTabs[0].soloLabel,
          icon: RotateCcw,
          section: guestTabs[0].section,
          tier: "core",
          matchPrefixes: guestTabs.map((t) => t.href),
        };
  // Insert the Guests entry right after Dashboard in any nav list.
  const withGuests = (items: NavItem[]): NavItem[] => {
    if (!guestsItem) return items;
    const out = [...items];
    const di = out.findIndex((i) => i.href === "/dashboard");
    out.splice(di >= 0 ? di + 1 : 0, 0, guestsItem);
    return out;
  };

  // Mobile drawer for managers/owners: split into "on the floor" (flat, up top)
  // and a collapsed "Set up & manage" group. Staff already get a lean flat nav,
  // and desktop keeps its full grouped nav — so this only reshapes the phone.
  const isMobileZoned = variant === "drawer" && !isStaff;
  const [manageOpen, setManageOpen] = useState(false);
  const byHref = new Map(ALL_NAV_ITEMS.map((it) => [it.href, it] as const));
  const resolveNav = (hrefs: string[]): NavItem[] =>
    hrefs
      .map((h) => (h === "/guests" ? guestsItem : byHref.get(h)))
      .filter((it): it is NavItem => !!it && (it === guestsItem || canSee(it.section)));
  const floorItems = isMobileZoned ? resolveNav(MOBILE_FLOOR_ORDER) : [];
  const manageItems = isMobileZoned ? resolveNav(MOBILE_MANAGE_ORDER) : [];

  // The single "More" expander. Start open iff the current page is a "more"
  // section (so the active page is never hidden and server/client markup match),
  // then honor the visitor's saved choice on mount. The active-page effect keeps
  // it open when navigating into a "more" section.
  const [moreOpen, setMoreOpen] = useState<boolean>(() => isMoreActive(pathname));
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MORE_STATE_KEY);
      if (saved === "1") setMoreOpen(true);
      else if (saved === "0") setMoreOpen(isMoreActive(pathname));
    } catch {
      // ignore unreadable/blocked storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (isMoreActive(pathname)) setMoreOpen(true);
  }, [pathname]);
  const toggleMore = () => {
    setMoreOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MORE_STATE_KEY, next ? "1" : "0");
      } catch {
        // ignore unwritable storage
      }
      return next;
    });
  };

  const navLink = (item: NavItem) => {
    const active = item.matchPrefixes
      ? item.matchPrefixes.some((p) => pathname.startsWith(p))
      : pathname.startsWith(item.href);
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
        {isStaff ? (
          // Staff see only a handful of sections — flat, no group headers or "More".
          withGuests(NAV_ITEMS.filter((it) => canSee(it.section))).map((it) => navLink(it))
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
          // Desktop: the core sections flat, then one "More" expander for the rest.
          (() => {
            const coreItems = withGuests(NAV_ITEMS.filter((it) => it.tier === "core" && canSee(it.section)));
            const moreItems = NAV_ITEMS.filter((it) => it.tier === "more" && canSee(it.section));
            const moreHasActive = moreItems.some((it) => pathname.startsWith(it.href));
            return (
              <>
                {coreItems.map((it) => navLink(it))}
                {moreItems.length > 0 && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={toggleMore}
                      aria-expanded={moreOpen}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2 hover:text-ink transition-colors"
                    >
                      {/* Tint "More" when it holds the current page but is collapsed. */}
                      <span className={!moreOpen && moreHasActive ? "text-brick" : ""}>More</span>
                      <ChevronDown size={14} className={`transition-transform duration-150 ${moreOpen ? "" : "-rotate-90"}`} />
                    </button>
                    {moreOpen && <div className="flex flex-col gap-0.5">{moreItems.map((it) => navLink(it))}</div>}
                  </div>
                )}
              </>
            );
          })()
        )}

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
