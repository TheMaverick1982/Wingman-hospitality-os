// Granular platform-admin (staff) access. is_platform_admin marks someone as
// platform staff; platform_access lists which /admin sections they may open.

// Page-backed sections: each has its own /admin page and sidebar nav item.
export type PlatformSection = "organizations" | "crm" | "support" | "reporting" | "billing" | "analytics" | "affiliates" | "social" | "coupons" | "sales_training" | "commissions" | "team";

// A grantable permission is either a page section or a capability toggle that
// isn't its own page (e.g. client_login gates "Log in as client").
export type PlatformPermission = PlatformSection | "client_login";

export const PLATFORM_SECTIONS: { key: PlatformSection; label: string; description: string; href: string }[] = [
  { key: "organizations", label: "Organizations", description: "Customer organizations — view and create.", href: "/admin/organizations" },
  { key: "crm", label: "CRM", description: "Sales pipeline — leads, contacts, and outreach.", href: "/admin/crm" },
  { key: "support", label: "Support", description: "View and reply to support tickets.", href: "/admin/support" },
  { key: "reporting", label: "Reporting", description: "Platform-wide reporting.", href: "/admin/reporting" },
  { key: "billing", label: "Billing", description: "Platform billing.", href: "/admin/billing" },
  { key: "analytics", label: "Analytics", description: "Platform analytics.", href: "/admin/analytics" },
  { key: "affiliates", label: "Affiliates", description: "Review affiliate applications, set commission, and view referrals.", href: "/admin/affiliates" },
  { key: "social", label: "Social", description: "Plan and schedule social media posts.", href: "/admin/social" },
  { key: "coupons", label: "Coupons", description: "Create discount codes and free trials.", href: "/admin/coupons" },
  { key: "sales_training", label: "Sales Training", description: "Demo playbook and guidance for staff who run demos.", href: "/admin/sales-training" },
  { key: "commissions", label: "Sales Commissions", description: "Track what sales reps are owed and mark commissions paid.", href: "/admin/sales-commissions" },
  { key: "team", label: "Team", description: "Add and manage platform staff and their access.", href: "/admin/team" },
];

// Everything grantable when setting up a teammate: the page sections above plus
// capability toggles. client_login is a capability, not a page — and a
// sensitive one, so it's granted explicitly rather than bundled with a section.
export const PLATFORM_ACCESS_OPTIONS: { key: PlatformPermission; label: string; description: string }[] = [
  ...PLATFORM_SECTIONS.map((s) => ({ key: s.key, label: s.label, description: s.description })),
  {
    key: "client_login",
    label: "Log in as client",
    description: "Open a customer's account with “Log in as client” to see exactly what they see. Grant only to people who need to troubleshoot inside a customer's account.",
  },
];

export function canAccessPlatformSection(access: string[] | undefined, section: PlatformPermission): boolean {
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
