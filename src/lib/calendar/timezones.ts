// Curated time-zone list for the booking availability picker. Mirrors the list in
// settings/edit-location-form.tsx (US-centric, matching our customer base) but
// kept here so calendar code doesn't import a client form.
export const BOOKING_TIMEZONES: readonly (readonly [string, string])[] = [
  ["America/New_York", "Eastern (New York)"],
  ["America/Chicago", "Central (Chicago)"],
  ["America/Denver", "Mountain (Denver)"],
  ["America/Phoenix", "Mountain – no DST (Phoenix)"],
  ["America/Los_Angeles", "Pacific (Los Angeles)"],
  ["America/Anchorage", "Alaska (Anchorage)"],
  ["Pacific/Honolulu", "Hawaii (Honolulu)"],
] as const;

const VALID = new Set(BOOKING_TIMEZONES.map(([v]) => v));

export function isValidTimeZone(tz: string): boolean {
  if (VALID.has(tz)) return true;
  // Accept any IANA zone the runtime recognizes (the invitee may pick their own).
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
