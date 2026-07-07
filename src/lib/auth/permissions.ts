export type AccessRole = "super_admin" | "manager" | "staff";
export type SectionAccess = "full" | "view" | "none";

export type Section =
  | "dashboard"
  | "culture"
  | "bounceback"
  | "recovery"
  | "training"
  | "accountability"
  | "hiring"
  | "reporting"
  | "settings";

// The permission matrix from the design handoff (README §3 / Settings ->
// Team & permissions). Super Admin is the account owner and always has
// full access. Guest Bounce Back and Hiring are hidden entirely from Staff,
// not just read-only, per the design.
const SECTION_ACCESS: Record<Section, Record<AccessRole, SectionAccess>> = {
  dashboard: { super_admin: "full", manager: "full", staff: "view" },
  culture: { super_admin: "full", manager: "full", staff: "view" },
  bounceback: { super_admin: "full", manager: "full", staff: "none" },
  recovery: { super_admin: "full", manager: "full", staff: "view" },
  training: { super_admin: "full", manager: "full", staff: "view" },
  accountability: { super_admin: "full", manager: "full", staff: "view" },
  hiring: { super_admin: "full", manager: "full", staff: "none" },
  reporting: { super_admin: "full", manager: "view", staff: "none" },
  settings: { super_admin: "full", manager: "none", staff: "none" },
};

export function getSectionAccess(role: AccessRole, section: Section): SectionAccess {
  return SECTION_ACCESS[section][role];
}

export function canEditSection(role: AccessRole, section: Section): boolean {
  return getSectionAccess(role, section) === "full";
}

export const ROLE_LABELS: Record<AccessRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  staff: "Staff",
};
