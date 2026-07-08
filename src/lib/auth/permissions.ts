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
  | "staff"
  | "growth"
  | "audit"
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
  staff: { super_admin: "full", manager: "full", staff: "none" },
  growth: { super_admin: "full", manager: "full", staff: "none" },
  audit: { super_admin: "full", manager: "full", staff: "none" },
  reporting: { super_admin: "full", manager: "view", staff: "none" },
  settings: { super_admin: "full", manager: "none", staff: "none" },
};

// Settings stays fixed to the owner -- Manager/Staff access there isn't
// overridable, since the server actions inside independently require
// Super Admin regardless of what this matrix says, so making it editable
// would just be a confusing dead end in the UI.
export const EDITABLE_SECTIONS: Section[] = [
  "dashboard",
  "culture",
  "bounceback",
  "recovery",
  "training",
  "accountability",
  "hiring",
  "staff",
  "growth",
  "audit",
  "reporting",
];

export type PermissionOverrides = Partial<Record<Section, Partial<Record<"manager" | "staff", SectionAccess>>>>;

export function getSectionAccess(role: AccessRole, section: Section, overrides?: PermissionOverrides): SectionAccess {
  if (role === "super_admin") return "full";
  if (section === "settings") return SECTION_ACCESS.settings[role];
  return overrides?.[section]?.[role] ?? SECTION_ACCESS[section][role];
}

export function canEditSection(role: AccessRole, section: Section, overrides?: PermissionOverrides): boolean {
  return getSectionAccess(role, section, overrides) === "full";
}

export const ROLE_LABELS: Record<AccessRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  staff: "Staff",
};
