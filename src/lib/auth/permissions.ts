export type AccessRole = "super_admin" | "manager" | "shift_lead" | "staff" | "developer";
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
  | "partners"
  | "reporting"
  | "questions"
  | "reviews"
  | "shift"
  | "manager_channel"
  | "settings";

// The permission matrix from the design handoff (README §3 / Settings ->
// Team & permissions). Super Admin is the account owner and always has
// full access. Guest Bounce Back and Hiring are hidden entirely from Staff,
// not just read-only, per the design.
// Shift Lead is an assistant-manager tier: full on the floor-operations sections
// (dashboard, culture/pre-shift, guest bounce back, recovery, training & tests,
// accountability), read-only on the design/reference sections (journey, hiring,
// staff roster, menu, audit), and no back office (growth, reporting, settings).
// "developer" is an API-only role — it uses a dedicated /api-access page, not
// these operational sections, so every section is "none" for it.
const SECTION_ACCESS: Record<Section, Record<AccessRole, SectionAccess>> = {
  dashboard: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view", developer: "none" },
  culture: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view", developer: "none" },
  bounceback: { super_admin: "full", manager: "full", shift_lead: "full", staff: "none", developer: "none" },
  // Service Recovery is manager-facing analytics (comps, how issues were made
  // right); staff don't action it, so it's hidden from them entirely.
  recovery: { super_admin: "full", manager: "full", shift_lead: "full", staff: "none", developer: "none" },
  training: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view", developer: "none" },
  journey: { super_admin: "full", manager: "full", shift_lead: "view", staff: "view", developer: "none" },
  accountability: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view", developer: "none" },
  hiring: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none", developer: "none" },
  staff: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none", developer: "none" },
  growth: { super_admin: "full", manager: "full", shift_lead: "none", staff: "none", developer: "none" },
  menu: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none", developer: "none" },
  audit: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none", developer: "none" },
  // Partners (B2B / Community) is an owner+manager relationship tool. Shift leads
  // and staff get no access — matched by the RLS gate on ('super_admin','manager').
  partners: { super_admin: "full", manager: "full", shift_lead: "none", staff: "none", developer: "none" },
  reporting: { super_admin: "full", manager: "view", shift_lead: "none", staff: "none", developer: "none" },
  // Staff questions: staff can view (their own escalated questions & answers);
  // managers/owners/shift leads get the full inbox to answer. The server actions
  // independently re-check role, so this drives visibility, not authority.
  questions: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view", developer: "none" },
  // Guest Reviews archive (survey responses + share links) is manager-facing;
  // staff get the positive shout-outs on the dashboard, not the raw archive.
  reviews: { super_admin: "full", manager: "full", shift_lead: "view", staff: "none", developer: "none" },
  // Shift board: managers/shift-leads post the day's board; all staff read it.
  shift: { super_admin: "full", manager: "full", shift_lead: "full", staff: "view", developer: "none" },
  // Manager channel: owners/managers/shift-leads only — staff never see it.
  manager_channel: { super_admin: "full", manager: "full", shift_lead: "full", staff: "none", developer: "none" },
  settings: { super_admin: "full", manager: "none", shift_lead: "none", staff: "none", developer: "none" },
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

// Human labels for each section, matching the sidebar nav.
export const SECTION_LABELS: Record<Section, string> = {
  dashboard: "Dashboard",
  culture: "Culture",
  bounceback: "Guest Bounce Back",
  recovery: "Service Recovery",
  training: "Training & Standards",
  journey: "Guest Journey",
  accountability: "Accountability",
  hiring: "Hiring",
  staff: "Staff",
  growth: "Revenue Growth Planner",
  menu: "Menu Engineering",
  audit: "Standout Audit",
  partners: "Partners",
  reporting: "Reporting",
  questions: "Questions",
  reviews: "Guest Reviews",
  shift: "Shift",
  manager_channel: "Manager channel",
  settings: "Settings",
};

// Sections an owner can hide from an INDIVIDUAL member (per-user, for a cleaner
// dashboard) — everything a manager might see except Dashboard (the home) and
// Settings (owner-only already). Ordered to mirror the sidebar.
export const HIDEABLE_SECTIONS: Section[] = [
  "bounceback",
  "reviews",
  "recovery",
  "journey",
  "shift",
  "manager_channel",
  "culture",
  "training",
  "accountability",
  "hiring",
  "staff",
  "questions",
  "growth",
  "menu",
  "audit",
  "partners",
  "reporting",
];

// A per-USER section override map (stored on profiles.section_overrides): the
// individual sections an owner has hidden from (or re-scoped for) one member,
// on top of the org-wide role defaults. Validated so junk can't widen access.
export type UserSectionOverrides = Partial<Record<Section, SectionAccess>>;

export function parseUserSectionOverrides(raw: unknown): UserSectionOverrides {
  if (!raw || typeof raw !== "object") return {};
  const hideable = new Set<string>(HIDEABLE_SECTIONS);
  const out: UserSectionOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (hideable.has(k) && (v === "none" || v === "view" || v === "full")) out[k as Section] = v;
  }
  return out;
}

// Fold a member's own per-section overrides into the org-wide overrides map,
// keyed by that member's role — so the existing getSectionAccess(role, section,
// overrides) call sites pick them up with no change. Owners/developers are never
// re-scoped (they get full / API-only respectively).
export function applyUserSectionOverrides(
  orgOverrides: PermissionOverrides | undefined,
  role: AccessRole,
  userOverrides: UserSectionOverrides | null | undefined,
): PermissionOverrides {
  const merged: PermissionOverrides = {};
  for (const [sec, byRole] of Object.entries(orgOverrides ?? {})) merged[sec as Section] = { ...byRole };
  if (!userOverrides || role === "super_admin" || role === "developer") return merged;
  const roleKey = role as "manager" | "shift_lead" | "staff";
  for (const [sec, access] of Object.entries(userOverrides)) {
    if (!access) continue;
    const s = sec as Section;
    merged[s] = { ...(merged[s] ?? {}), [roleKey]: access };
  }
  return merged;
}

export function getSectionAccess(role: AccessRole, section: Section, overrides?: PermissionOverrides): SectionAccess {
  if (role === "super_admin") return "full";
  if (section === "settings") return SECTION_ACCESS.settings[role];
  // Only manager/shift_lead/staff are editable in the permissions matrix.
  if (role !== "developer") {
    const override = overrides?.[section]?.[role];
    if (override) return override;
  }
  return SECTION_ACCESS[section][role];
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
  developer: "Developer",
};

// Whether a role gets the API-only developer experience (the /api-access page).
export function isDeveloper(role: AccessRole): boolean {
  return role === "developer";
}
// Who may manage API keys + reach the developer area: the owner and developers.
export function canManageApi(role: AccessRole): boolean {
  return role === "super_admin" || role === "developer";
}
