// Structured weekly availability for job applications: applicants tick the shifts
// they can work (per day), or choose "Anytime" if they're fully flexible. Stored
// as a flat array of "day:shift" cell ids (e.g. "mon:evening"), with the single
// value "anytime" meaning flexible. Shared by the public apply form (client), the
// submit action (server), and the Applicants filter.

export const AVAIL_DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
] as const;

export const AVAIL_SHIFTS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
] as const;

export const ANYTIME = "anytime";

export type AvailDayId = (typeof AVAIL_DAYS)[number]["id"];
export type AvailShiftId = (typeof AVAIL_SHIFTS)[number]["id"];

const DAY_IDS = new Set<string>(AVAIL_DAYS.map((d) => d.id));
const SHIFT_IDS = new Set<string>(AVAIL_SHIFTS.map((s) => s.id));
const DAY_LABEL = new Map<string, string>(AVAIL_DAYS.map((d) => [d.id, d.label]));
const SHIFT_LABEL = new Map<string, string>(AVAIL_SHIFTS.map((s) => [s.id, s.label]));
const WEEKDAYS = new Set(["mon", "tue", "wed", "thu", "fri"]);

// Validate + de-dupe an incoming list of cells. Anything unrecognized is dropped.
// If "anytime" is present it collapses to just ["anytime"].
export function normalizeShifts(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out = new Set<string>();
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const v = raw.trim().toLowerCase();
    if (v === ANYTIME) return [ANYTIME];
    const [d, s] = v.split(":");
    if (DAY_IDS.has(d) && SHIFT_IDS.has(s)) out.add(`${d}:${s}`);
  }
  return [...out];
}

// Human-readable summary for the applicant card, emails, and the free-text
// availability column (kept in sync so existing displays keep working).
export function summarizeShifts(cells: string[]): string {
  if (cells.includes(ANYTIME)) return "Anytime / flexible";
  const byDay = new Map<string, string[]>();
  for (const c of cells) {
    const [d, s] = c.split(":");
    (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(s);
  }
  const parts: string[] = [];
  for (const d of AVAIL_DAYS) {
    const shifts = byDay.get(d.id);
    if (!shifts || shifts.length === 0) continue;
    const ordered = AVAIL_SHIFTS.filter((s) => shifts.includes(s.id)).map((s) => SHIFT_LABEL.get(s.id)!);
    parts.push(`${DAY_LABEL.get(d.id)}: ${ordered.length === AVAIL_SHIFTS.length ? "all day" : ordered.join(", ")}`);
  }
  return parts.join(" · ");
}

// The filter buckets shown on the Applicants tracker.
export const AVAIL_BUCKETS: { id: string; label: string }[] = [
  { id: "weekdays", label: "Weekdays" },
  { id: "weekends", label: "Weekends" },
  { id: "mornings", label: "Mornings" },
  { id: "afternoons", label: "Afternoons" },
  { id: "evenings", label: "Evenings" },
  { id: "anytime", label: "Anytime" },
];

// Keyword fallback for OLDER applications that only have the free-text
// availability (submitted before the shift grid existed), so the same filter
// buckets work across all applications — new and old.
const BUCKET_KEYWORDS: Record<string, RegExp> = {
  weekdays: /weekday|week day|monday|tuesday|wednesday|thursday|friday|\bmon\b|\btues?\b|\bweds?\b|\bthurs?\b|\bfri\b|m-?f|weeknight/,
  weekends: /weekend|saturday|sunday|\bsat\b|\bsun\b/,
  mornings: /morning|breakfast|\bam\b|open(?:ing|er)?|day ?time|brunch/,
  afternoons: /afternoon|mid[\s-]?day|lunch|\bday\b/,
  evenings: /night|evening|\bpm\b|dinner|clos(?:e|ing|er)|late|weeknight/,
  anytime: /any ?time|\bflexible\b|whenever|open availability|all day|immediate|\basap\b|any shift/,
};
export function keywordMatchBucket(text: string, bucketId: string): boolean {
  const re = BUCKET_KEYWORDS[bucketId];
  if (!re) return true;
  return re.test((text || "").toLowerCase());
}

// Does an applicant match a bucket? Uses the structured ticks when present,
// otherwise falls back to keyword-matching their free-text availability.
export function applicantMatchesBucket(shifts: string[], availabilityText: string, bucketId: string): boolean {
  if (shifts.length > 0) return shiftsMatchBucket(shifts, bucketId);
  return keywordMatchBucket(availabilityText, bucketId);
}

// Does a structured availability (cells) satisfy a filter bucket? "anytime"
// (flexible) matches every bucket.
export function shiftsMatchBucket(cells: string[], bucketId: string): boolean {
  if (cells.includes(ANYTIME)) return true;
  const some = (pred: (day: string, shift: string) => boolean) =>
    cells.some((c) => {
      const [d, s] = c.split(":");
      return pred(d, s);
    });
  switch (bucketId) {
    case "weekdays": return some((d) => WEEKDAYS.has(d));
    case "weekends": return some((d) => d === "sat" || d === "sun");
    case "mornings": return some((_, s) => s === "morning");
    case "afternoons": return some((_, s) => s === "afternoon");
    case "evenings": return some((_, s) => s === "evening");
    case "anytime": return false; // only true via the ANYTIME short-circuit above
    default: return true;
  }
}
