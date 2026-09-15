import { getSectionAccess, type Section, type PermissionOverrides, type AccessRole } from "@/lib/auth/permissions";

// The four guest-facing tools now live under one "Guests" surface with tabs,
// instead of four separate nav destinations. This is the single source of truth
// for that tab set — used by both the sidebar (one "Guests" entry) and the tab
// strip rendered on each of the four pages. Labels drop the redundant "Guest"
// prefix since the parent surface already says "Guests".
// `label` is the tab label under the Guests surface; `soloLabel` is the full,
// self-describing name used when this is the ONLY guest tab a person can see, so
// a single nav entry still reads clearly (e.g. staff who only get "Guest Journey").
export type GuestTab = { href: string; label: string; soloLabel: string; section: Section };

export const GUEST_TABS: GuestTab[] = [
  { href: "/bounceback", label: "Bounce Back", soloLabel: "Guest Bounce Back", section: "bounceback" },
  { href: "/reviews", label: "Reviews", soloLabel: "Guest Reviews", section: "reviews" },
  { href: "/recovery", label: "Service Recovery", soloLabel: "Service Recovery", section: "recovery" },
  { href: "/journey", label: "Journey", soloLabel: "Guest Journey", section: "journey" },
];

export const GUEST_TAB_HREFS = GUEST_TABS.map((t) => t.href);

// The guest tabs this person can actually open (respects role + per-manager
// section hiding). An empty list means the whole Guests surface is hidden.
export function accessibleGuestTabs(role: AccessRole, overrides?: PermissionOverrides): GuestTab[] {
  return GUEST_TABS.filter((t) => getSectionAccess(role, t.section, overrides) !== "none");
}
