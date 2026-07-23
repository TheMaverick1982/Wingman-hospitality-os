// The calendar date (YYYY-MM-DD) *at a given place*, not in UTC.
//
// Anything that resets or buckets by "day" from a person's point of view — a
// pre-shift checklist that should be fresh for each day's shift, a "who
// completed today" report — must use the restaurant's local day, otherwise the
// boundary lands at UTC midnight (early evening in the Americas) and the day
// appears to roll over mid-service. Locations carry a `timezone`; pass it here.
//
// Falls back to UTC when no timezone is set or the IANA name is unrecognized,
// which preserves the previous behavior rather than throwing.
export function localDate(timezone?: string | null, at: Date = new Date()): string {
  if (timezone) {
    try {
      // en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(at);
    } catch {
      // Unknown/invalid IANA zone — fall through to UTC.
    }
  }
  return at.toISOString().slice(0, 10);
}
