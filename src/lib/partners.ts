// Shared types + helpers for the Partners (B2B / Community) module.
//
// Partners is a relationship CRM: managers track the local businesses around
// each store and every touch (call, email, meeting, booked event/fundraiser)
// against them, so community revenue becomes a measured habit rather than luck.

export type PartnerActivityType =
  | "call_text"
  | "email"
  | "meeting"
  | "visit"
  | "in_store_guest"
  | "event_booked"
  | "fundraiser_booked"
  | "note";

// Outreach pipeline status for a contact — the accountability signal ("who still
// needs a call back", "who's booked"). 'none' = not yet set.
export type OutreachStatus = "none" | "no_answer" | "follow_up" | "booked" | "not_interested";

export const OUTREACH_STATUSES: { value: OutreachStatus; label: string; fg: string; bg: string }[] = [
  { value: "none", label: "No status", fg: "text-muted-2", bg: "bg-panel" },
  { value: "no_answer", label: "No answer", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]" },
  { value: "follow_up", label: "Follow up", fg: "text-[#0a6cff]", bg: "bg-[#E8F1FF]" },
  { value: "booked", label: "Booked", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]" },
  { value: "not_interested", label: "Not interested", fg: "text-muted", bg: "bg-panel" },
];

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = Object.fromEntries(
  OUTREACH_STATUSES.map((s) => [s.value, s.label]),
) as Record<OutreachStatus, string>;

// The allowed status string values (for server-side validation).
export const OUTREACH_STATUS_VALUES: string[] = OUTREACH_STATUSES.map((s) => s.value);

// What a partner has expressed interest in — drives bookings and reporting.
export const INTERESTED_IN_OPTIONS = ["Party", "Fundraiser", "Catering", "Class", "Partner"] as const;
export type InterestedIn = (typeof INTERESTED_IN_OPTIONS)[number];

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
  outreach_status: OutreachStatus;
  interested_in: string[];
  handed_off_to: string;
  next_step: string;
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
  event_date: string | null; // YYYY-MM-DD, for event/fundraiser bookings
  headcount: number | null;
  set_status: OutreachStatus | null; // status this touch set the contact to
  set_handoff: string | null; // hand-off this touch recorded
  created_by: string | null;
  created_at: string;
};

// A relationship goes "fading" after this many days with no touch. Above this
// (or never touched) a contact shows the orange "Needs Follow-up" badge.
export const FADING_DAYS = 30;

// Standing per-quarter targets. location_id null = org-wide default.
export type PartnerGoal = {
  location_id: string | null;
  goal_new_contacts: number;
  goal_events: number;
  goal_fundraisers: number;
  goal_active_connections: number;
};

// Seeded defaults if an owner hasn't set anything yet.
export const DEFAULT_GOALS = {
  goal_new_contacts: 20,
  goal_events: 3,
  goal_fundraisers: 3,
  goal_active_connections: 20,
};

// Resolve the target for a location: its own row, else the org default, else the
// hard defaults. Pass a map of location_id -> goal and the org-default goal.
export function resolveGoal(
  byLocation: Map<string, PartnerGoal>,
  orgDefault: PartnerGoal | null,
  locationId: string | null
): typeof DEFAULT_GOALS {
  const row = (locationId && byLocation.get(locationId)) || orgDefault;
  return {
    goal_new_contacts: row?.goal_new_contacts ?? DEFAULT_GOALS.goal_new_contacts,
    goal_events: row?.goal_events ?? DEFAULT_GOALS.goal_events,
    goal_fundraisers: row?.goal_fundraisers ?? DEFAULT_GOALS.goal_fundraisers,
    goal_active_connections: row?.goal_active_connections ?? DEFAULT_GOALS.goal_active_connections,
  };
}

export const ACTIVITY_TYPES: { value: PartnerActivityType; label: string; countsAsEvent?: boolean }[] = [
  { value: "call_text", label: "Called or Texted" },
  { value: "email", label: "Emailed" },
  { value: "meeting", label: "Meeting" },
  { value: "visit", label: "Visit" },
  { value: "in_store_guest", label: "In-store guest" },
  { value: "event_booked", label: "Event Booked", countsAsEvent: true },
  { value: "fundraiser_booked", label: "Fundraiser Booked", countsAsEvent: true },
];

// ACTIVITY_TYPES are the loggable "touch" types shown in the Log Activity picker.
// 'note' is not a touch you pick there — it's added from a contact's Notes box —
// but it still needs a label for the timeline, so include it here explicitly.
export const ACTIVITY_LABELS: Record<PartnerActivityType, string> = {
  ...(Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t.label])) as Record<PartnerActivityType, string>),
  note: "Note",
};

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
