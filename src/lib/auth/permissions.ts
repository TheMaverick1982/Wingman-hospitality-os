export type AccessRole = "super_admin" | "manager" | "shift_lead" | "staff";
export type SectionAccess = "full" | "view" | "none";

export type Section =
  | "dashboard"
  | "culture"
  | "bounceback"
  | "recovery"
  | "training"
  | "journey"
  | "accountability"
  | "hiring"
  | "staff"
  | "growth"
  | "menu"
  | "audit"
  | "reporting"
  | "settings";

// The permission matrix from the design handoff (README §3 / Settings ->
// Team & permissions). Super Admin is the account owner and always has
// full access. Guest Bounce Back and Hiring are hidden entirely from Staff,
// not just read-only, per the design.
// Shift Lead is an assistant-manager tier: full on the floor-operations sections
// (dashboard, culture/pre-shift, guest bounce back, recovery, training & tests,
// accountability), read-only on the design/reference sections (journey, hiring,
// staff roster, menu, audit), and no back office (growth, reporting, settings).
const SECTION_ACCESS: Record<Section, Record<AccessRole, SectionAccess>> = {
  dashboard: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view" },
  culture: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view" },
  bounceback: { super_admin: "full", manager: "full", shift_lead: "full", staff: "none" },
  recovery: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view" },
  training: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view" },
  journey: { super_admin: "full", manager: "full", shift_lead: "view", staff: "view" },
  accountability: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view" },
  hiring: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none" },
  staff: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none" },
  growth: { super_admin: "full", manager: "full", shift_lead: "none", staff: "none" },
  menu: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none" },
  audit: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none" },
  reporting: { super_admin: "full", manager: "view", shift_lead: "none", staff: "none" },
  settings: { super_admin: "full", manager: "none", shift_lead: "none", staff: "none" },
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
  "journey",
  "accountability",
  "hiring",
  "staff",
  "growth",
  "menu",
  "audit",
  "reporting",
];

export type PermissionOverrides = Partial<Record<Section, Partial<Record<"manager" | "shift_lead" | "staff", SectionAccess>>>>;

export function getSectionAccess(role: AccessRole, section: Section, overrides?: PermissionOverrides): SectionAccess {
  if (role === "super_admin") return "full";
  if (section === "settings") return SECTION_ACCESS.settings[role];
  return overrides?.[section]?.[role] ?? SECTION_ACCESS[section][role];
}

export function canEditSection(role: AccessRole, section: Section, overrides?: PermissionOverrides): boolean {
  return getSectionAccess(role, section, overrides) === "full";
}

// "Manager or above" — everyone who can run the floor (owner, manager, shift
// lead). Mirrors the is_manager_or_above() RLS helper. Use for operational
// gates; keep an explicit `=== "super_admin"` for owner-only actions.
export function isManagerOrAbove(role: AccessRole): boolean {
  return role === "super_admin" || role === "manager" || role === "shift_lead";
}

export const ROLE_LABELS: Record<AccessRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  shift_lead: "Shift Lead",
  staff: "Staff",
};
