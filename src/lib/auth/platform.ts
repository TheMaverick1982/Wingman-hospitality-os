// Granular platform-admin (staff) access. is_platform_admin marks someone as
// platform staff; platform_access lists which /admin sections they may open.

export type PlatformSection = "organizations" | "support" | "reporting" | "billing" | "analytics" | "team";

export const PLATFORM_SECTIONS: { key: PlatformSection; label: string; description: string; href: string }[] = [
  { key: "organizations", label: "Organizations", description: "Customer organizations — view, create, and impersonate.", href: "/admin/organizations" },
  { key: "support", label: "Support", description: "View and reply to support tickets.", href: "/admin/support" },
  { key: "reporting", label: "Reporting", description: "Platform-wide reporting.", href: "/admin/reporting" },
  { key: "billing", label: "Billing", description: "Platform billing.", href: "/admin/billing" },
  { key: "analytics", label: "Analytics", description: "Platform analytics.", href: "/admin/analytics" },
  { key: "team", label: "Team", description: "Add and manage platform staff and their access.", href: "/admin/team" },
];

export function canAccessPlatformSection(access: string[] | undefined, section: PlatformSection): boolean {
  return Boolean(access?.includes(section));
}

// The first section a staff member can open — used to land them somewhere they
// actually have access to instead of a section they'd be bounced from.
export function firstAccessibleSection(access: string[] | undefined): PlatformSection | null {
  for (const s of PLATFORM_SECTIONS) {
    if (access?.includes(s.key)) return s.key;
  }
  return null;
}
