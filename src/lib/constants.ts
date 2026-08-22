export const ALL_DEPARTMENTS = [
  "Host",
  "Server",
  "Busser",
  "Food Runner",
  "Bartender",
  "Barista",
  "Cashier",
  "Chef",
  "Sous Chef",
  "Line Cook",
  "Pizza Cook",
  "Prep Cook",
  "Dishwasher",
  "Expo",
  "Sommelier",
  "Kitchen Manager",
  "Manager",
  "Assistant Manager",
] as const;
export type Department = (typeof ALL_DEPARTMENTS)[number];

// A job opening (and only a job opening) can use this bucket for a custom role
// that isn't one of the standard departments above — e.g. "Baker", "Valet",
// "Event Lead". The real, human-readable role name lives in the opening's `title`
// and is what shows everywhere. This is intentionally NOT in ALL_DEPARTMENTS, so
// it never appears in staff roles, training, or standards; it only gives an
// opening (and any candidate scored from it) a valid enum value to fall back to.
export const OPENING_OTHER_ROLE = "Other";
// A role string is valid for an opening if it's a standard department or the
// custom "Other" bucket.
export function isOpeningRole(d: string): boolean {
  return (ALL_DEPARTMENTS as readonly string[]).includes(d) || d === OPENING_OTHER_ROLE;
}

// A staff member's effective role set: their primary `department` first, then
// any `additional_departments` (deduped, invalid/blank values dropped). Use this
// everywhere a staff user's training, menu, tests, or checklists should span all
// the roles they hold — not just their primary one. Kept pure so it's usable on
// both server and client.
export function effectiveRoles(primary: string | null | undefined, additional?: readonly string[] | null): Department[] {
  const seen = new Set<string>();
  const out: Department[] = [];
  for (const d of [primary, ...(additional ?? [])]) {
    if (d && !seen.has(d) && (ALL_DEPARTMENTS as readonly string[]).includes(d)) {
      seen.add(d);
      out.push(d as Department);
    }
  }
  return out;
}

// The roles the Setup Wizard pre-selects (kept to the common core so the single
// AI generation stays focused). Owners check any extra roles they actually have.
export const WIZARD_DEFAULT_DEPARTMENTS: Department[] = ["Host", "Server", "Bartender", "Chef", "Manager"];

// Front-of-house roles — the people who touch the guest and can capture loyalty
// at the table/bar. Used to target the FOH loyalty checklist.
export const FOH_DEPARTMENTS: Department[] = ["Host", "Server", "Busser", "Food Runner", "Bartender", "Barista", "Cashier", "Expo", "Sommelier"];

// Roles a guest might name as "who took care of me" on the survey — front of
// house plus the managers who work the floor and touch tables.
export const GUEST_FACING_DEPARTMENTS: Department[] = [...FOH_DEPARTMENTS, "Manager", "Assistant Manager"];

// Menu grouping. The restaurant has ONE food menu and ONE bar menu; a dish's
// department places it in a group rather than siloing it to a single role.
// Front-of-house (Server) and the kitchen (Chef) SHARE the food menu — servers
// learn the knowledge to sell it, the kitchen also gets the "how to make it"
// recipe. Bartenders/Baristas own the bar menu. So a role sees its group's menu.
export const BAR_MENU_DEPARTMENTS: Department[] = ["Bartender", "Barista"];
export function menuGroup(dept: string): "food" | "bar" {
  return BAR_MENU_DEPARTMENTS.includes(dept as Department) ? "bar" : "food";
}

// The roles that see a dish's "how to make it" recipe layer — the people who
// MAKE the item. The kitchen makes food; the bartender makes drinks. So each
// maker gets recipes for their own group's dishes. Managers/owners see and edit
// every recipe separately, via their edit permission.
export const RECIPE_MAKER_ROLES: Department[] = ["Chef", "Bartender"];

export const DISCOUNT_CATEGORIES = [
  "Food Quality Issue",
  "Temperature Issue",
  "Ticket Accuracy Issue",
  "Service Delay",
  "Hospitality Recovery Gesture",
  "System/Operational Error",
  "Never Greeted",
  "Order Errors",
  "Walkout",
  "Rude Interaction",
  "Wrong Check",
  "Other",
] as const;

export const CULTURE_TAGS = ["Ownership", "Guest Connection", "Teamwork", "Went Above"] as const;

export const SPOT_CHECK_DIMENSIONS = [
  "Energy / Presence",
  "Personalization",
  "Guidance (Sales Behavior)",
  "Awareness",
  "Closing (Return Setup)",
] as const;

export const DAILY_CHECKLIST_ITEMS = [
  "Walked the floor during every peak period",
  "Personally approached at least 3 returning guests",
  "Thanked every departing guest personally",
  "Logged today's first-time guest bounce-back interactions",
  "Confirmed bathrooms, entry, and dining room hit standard",
  "Coached at least one real-time moment (correction or praise)",
] as const;

export const RECOMMENDATION_OPTIONS = ["Strong fit", "Fit", "Unsure", "Not a fit"] as const;

export const PRE_SHIFT_ITEMS = [
  "Uniform and appearance are shift-ready",
  "Know tonight's specials and any 86'd items",
  "Know today's reservations and any large parties",
  "Reviewed yesterday's guest feedback or flags",
  "Ready to set the tone — positive energy at the door",
] as const;

// FOH loyalty checklist — capture and take care of loyalty members at every
// table and the bar. Completed by front-of-house staff during their shift.
export const LOYALTY_CHECKLIST_ITEMS = [
  "Asked every guest if they're a loyalty member",
  "Signed up interested guests who weren't members yet",
  "Added the loyalty number for members missing it",
  "Checked members' points and available rewards",
  "Told members about a reward they could redeem today",
  "Applied loyalty to the check before closing it",
] as const;

// Server standards checklist — a pre-shift acknowledgment each server reads and
// checks off, so the hospitality standard is front-of-mind before service. A
// generic, de-branded best-practice version; every org can edit it.
export const SERVER_CHECKLIST_ITEMS = [
  "I'm here to create guest experiences, not just take orders",
  "I make every guest feel recognized, valued, and taken care of",
  "I acknowledge every guest immediately with eye contact and a greeting",
  "If I'm busy, I verbally acknowledge guests right away",
  "I treat every guest as an individual, not a transaction",
  "I read the table and adjust — I never sound scripted",
  "I recognize returning guests and use their names when I can",
  "I ask if it's their first visit and flag first-timers to a manager",
  "I make confident recommendations, not just take the order",
  "I use the 3-touch model: pre-meal, mid-meal, post-meal",
  "I stay aware of my tables — drinks, plates, and body language",
  "I move with urgency so nothing feels slow or forgotten",
  "I check in early to catch issues before they escalate",
  "I involve a manager early when something needs fixing",
  "I thank every guest sincerely and give them a reason to return",
  "I aim to deliver a 5-star experience every shift",
  "I ask for a review only when the experience was clearly great",
  "I uphold the standard regardless of my role or position",
  "I'll create at least one memorable moment this shift",
  "Guests should leave thinking: they take care of people here",
] as const;

export const AMBIANCE_DIMENSIONS = [
  "Cleanliness (floors, tables, restrooms)",
  "Music volume & selection",
  "Lighting",
  "Host stand / entrance first impression",
  "Temperature comfort",
  "Sight lines & flow (open path, no dead-end corners)",
  "Seating comfort & spacing",
] as const;
