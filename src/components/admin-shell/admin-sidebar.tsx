"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  BarChart3,
  CreditCard,
  LineChart,
  LifeBuoy,
  Users,
  Share2,
  Inbox,
  Contact,
  MessagesSquare,
  CalendarClock,
  CalendarCheck,
  Ticket,
  GraduationCap,
  Wallet,
  Gauge,
  UserCog,
  BookOpen,
  ArrowLeft,
  ChevronDown,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { PLATFORM_SECTIONS, type PlatformSection } from "@/lib/auth/platform";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: PlatformSection; // gated by this platform section
  superOnly?: boolean; // owner-only (all sections granted)
  always?: boolean; // shown to every platform staffer (e.g. personal Calendar)
};

type NavGroup = { key: string; label: string; icon: LucideIcon; items: NavItem[] };
type NavEntry = { kind: "item"; item: NavItem } | { kind: "group"; group: NavGroup };

// Sidebar order: Customers · CRM · Sales · Marketing · Insights · Team.
const NAV: NavEntry[] = [
  {
    kind: "group",
    group: {
      key: "customers",
      label: "Customers",
      icon: Building2,
      items: [
        { href: "/admin/organizations", label: "Organizations", icon: Building2, section: "organizations" },
        { href: "/admin/franchises", label: "Franchises", icon: Building2, section: "organizations" },
        { href: "/admin/billing", label: "Billing", icon: CreditCard, section: "billing" },
        { href: "/admin/support", label: "Support", icon: LifeBuoy, section: "support" },
      ],
    },
  },
  { kind: "item", item: { href: "/admin/crm", label: "CRM", icon: Contact, section: "crm" } },
  { kind: "item", item: { href: "/admin/conversations", label: "Conversations", icon: MessagesSquare, section: "crm" } },
  {
    kind: "group",
    group: {
      key: "sales",
      label: "Sales",
      icon: Gauge,
      items: [
        { href: "/admin/sales-dashboard", label: "Sales Dashboard", icon: Gauge, section: "sales_dashboard" },
        { href: "/admin/leads", label: "Leads", icon: Inbox, section: "analytics" },
        { href: "/admin/calendar", label: "Calendar", icon: CalendarCheck, always: true },
        { href: "/admin/sales-training", label: "Sales Training", icon: GraduationCap, section: "sales_training" },
        { href: "/admin/sales-commissions", label: "Sales Commissions", icon: Wallet, section: "commissions" },
        { href: "/admin/sales-team", label: "Sales Team", icon: UserCog, superOnly: true },
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "marketing",
      label: "Marketing",
      icon: Megaphone,
      items: [
        { href: "/admin/social", label: "Social", icon: CalendarClock, section: "social" },
        { href: "/admin/playbook", label: "The Playbook", icon: BookOpen, section: "social" },
        { href: "/admin/affiliates", label: "Affiliates", icon: Share2, section: "affiliates" },
        { href: "/admin/coupons", label: "Coupons", icon: Ticket, section: "coupons" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "insights",
      label: "Insights",
      icon: BarChart3,
      items: [
        { href: "/admin/reporting", label: "Reporting", icon: BarChart3, section: "reporting" },
        { href: "/admin/analytics", label: "Analytics", icon: LineChart, section: "analytics" },
      ],
    },
  },
  { kind: "item", item: { href: "/admin/team", label: "Team", icon: Users, section: "team" } },
];

export function AdminSidebar({ fullName, platformAccess }: { fullName: string; platformAccess: string[] }) {
  const pathname = usePathname();
  const isSuper = PLATFORM_SECTIONS.every((s) => platformAccess.includes(s.key));

  const canSee = (item: NavItem): boolean => {
    if (item.always) return true;
    if (item.superOnly) return isSuper;
    return item.section ? platformAccess.includes(item.section) : true;
  };
  const isActive = (href: string) => pathname.startsWith(href);

  // Which group holds the current page — used to auto-expand it.
  let activeGroup: string | undefined;
  for (const entry of NAV) {
    if (entry.kind === "group" && entry.group.items.some((i) => isActive(i.href))) {
      activeGroup = entry.group.key;
      break;
    }
  }
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));
  const isOpen = (key: string) => open.has(key) || key === activeGroup;
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const itemLink = (item: NavItem, indented: boolean) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 ${indented ? "pl-9 pr-3" : "px-3"} py-[9px] rounded-[10px] text-sm transition-colors ${
          active ? "bg-brick text-white font-semibold" : "text-charcoal-2 font-medium hover:bg-paper"
        }`}
      >
        <item.icon size={18} strokeWidth={2} className={active ? "text-white/90" : "text-muted-2"} />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="w-[248px] shrink-0 bg-white border-r border-line py-5 px-4 flex flex-col sticky top-0 h-screen">
      <div className="flex items-center px-2.5 pb-1">
        <WingmanLogo className="h-6 w-auto" />
      </div>
      <div className="px-2.5 pb-6">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-brick">Platform Admin</span>
      </div>

      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map((entry) => {
          if (entry.kind === "item") {
            if (!canSee(entry.item)) return null;
            return (
              <div key={entry.item.href} className="mt-0.5">
                {itemLink(entry.item, false)}
              </div>
            );
          }
          const group = entry.group;
          const visible = group.items.filter(canSee);
          if (visible.length === 0) return null;
          const expanded = isOpen(group.key);
          const hasActive = visible.some((i) => isActive(i.href));
          return (
            <div key={group.key} className="mt-0.5">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                className={`w-full flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-sm font-semibold transition-colors ${
                  hasActive && !expanded ? "text-brick" : "text-charcoal-2 hover:bg-paper"
                }`}
              >
                <group.icon size={18} strokeWidth={2} className="text-muted-2" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown size={16} strokeWidth={2.5} className={`text-muted-2 transition-transform ${expanded ? "" : "-rotate-90"}`} />
              </button>
              {expanded && <div className="flex flex-col gap-0.5 mt-0.5">{visible.map((item) => itemLink(item, true))}</div>}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-3">
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
