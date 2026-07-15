// Shared types + helpers for the Partners (B2B / Community) module.
//
// Partners is a relationship CRM: managers track the local businesses around
// each store and every touch (call, email, meeting, booked event/fundraiser)
// against them, so community revenue becomes a measured habit rather than luck.

export type PartnerActivityType = "call_text" | "email" | "meeting" | "event_booked" | "fundraiser_booked";

export type PartnerContact = {
  id: string;
  location_id: string | null;
  company_name: string;
  contact_name: string;
  title: string;
  email: string;
  phone: string;
  category: string;
  subcategory: string;
  website: string;
  address: string;
  notes: string;
  status: "active" | "archived";
  last_activity_at: string | null; // YYYY-MM-DD or null (never contacted)
  created_by: string | null;
  created_at: string;
};

export type PartnerActivity = {
  id: string;
  contact_id: string;
  location_id: string | null;
  activity_date: string; // YYYY-MM-DD
  activity_type: PartnerActivityType;
  notes: string;
  revenue_cents: number | null;
  created_by: string | null;
  created_at: string;
};

// A relationship goes "fading" after this many days with no touch. Above this
// (or never touched) a contact shows the orange "Needs Follow-up" badge.
export const FADING_DAYS = 30;

export const ACTIVITY_TYPES: { value: PartnerActivityType; label: string; countsAsEvent?: boolean }[] = [
  { value: "call_text", label: "Called or Texted" },
  { value: "email", label: "Emailed" },
  { value: "meeting", label: "Meeting" },
  { value: "event_booked", label: "Event Booked", countsAsEvent: true },
  { value: "fundraiser_booked", label: "Fundraiser Booked", countsAsEvent: true },
];

export const ACTIVITY_LABELS: Record<PartnerActivityType, string> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.value, t.label])
) as Record<PartnerActivityType, string>;

// Suggested categories for the surrounding-business types a restaurant partners
// with. Free-text is still allowed; these just seed the dropdown.
export const PARTNER_CATEGORIES = [
  "Corporate Office",
  "School / University",
  "Non-profit",
  "Chamber of Commerce",
  "Gym / Studio",
  "Hotel / Lodging",
  "Medical / Dental",
  "Real Estate",
  "Retail / Shop",
  "Event Venue",
  "Other",
];

// Whole days between a YYYY-MM-DD date and `now` (a Date.now() epoch ms). Parses
// the date parts so there's no timezone drift.
export function daysSinceDate(dateStr: string, now: number): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// Days since a contact's last activity, or null if never contacted.
export function daysSinceLastActivity(contact: PartnerContact, now: number): number | null {
  if (!contact.last_activity_at) return null;
  return daysSinceDate(contact.last_activity_at, now);
}

// A never-contacted or 30+-day-stale contact needs follow-up.
export function isFading(contact: PartnerContact, now: number): boolean {
  const days = daysSinceLastActivity(contact, now);
  return days === null || days >= FADING_DAYS;
}

export function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// Format YYYY-MM-DD without timezone drift.
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Quarter (1–4) and year for a given epoch-ms instant, computed from a
// YYYY-MM-DD "today" string so it stays timezone-stable.
export function quarterOf(todayIso: string): { year: number; quarter: number } {
  const [y, m] = todayIso.slice(0, 10).split("-").map(Number);
  return { year: y, quarter: Math.floor((m - 1) / 3) + 1 };
}

// First day (YYYY-MM-DD) of the quarter that contains todayIso.
export function quarterStart(todayIso: string): string {
  const { year, quarter } = quarterOf(todayIso);
  const startMonth = (quarter - 1) * 3 + 1;
  return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}
