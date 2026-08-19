// Time-zone display + conversion helpers, built on native Intl (no tz library in
// this repo). Locations carry an IANA `timezone` (e.g. "America/New_York"); times
// that belong to a place — when a staffer was active, when an interview is — must
// be shown in that place's zone, not the viewer's browser or the UTC server, so a
// multi-location chain reads correctly across the country.
//
// All functions fall back gracefully on a missing/invalid zone (treated as UTC)
// rather than throwing.

const DEFAULT_TZ = "America/New_York";

// Offset (ms) of an IANA zone at a given instant: localWallTime − utc.
function tzOffsetMs(timeZone: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(atMs));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour),
    Number(m.minute),
    Number(m.second)
  );
  return asUTC - atMs;
}

function safeZone(tz?: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// Convert a naive wall-clock string from a <input type="datetime-local">
// ("YYYY-MM-DDTHH:mm") into the UTC instant it represents IN a given zone. Two
// passes so it stays correct across DST boundaries. Returns null on bad input.
export function wallClockToUtc(wall: string, timeZone?: string | null): Date | null {
  if (!wall) return null;
  const normalized = wall.length === 16 ? `${wall}:00` : wall; // add seconds if absent
  const asIfUtc = Date.parse(`${normalized}Z`);
  if (Number.isNaN(asIfUtc)) return null;
  const tz = safeZone(timeZone);
  const guess = asIfUtc - tzOffsetMs(tz, asIfUtc);
  const instant = asIfUtc - tzOffsetMs(tz, guess);
  return new Date(instant);
}

// Convert a UTC instant (ISO string or Date) into the "YYYY-MM-DDTHH:mm" wall
// clock IN a zone, for seeding a <input type="datetime-local">.
export function utcToWallClockInput(at: string | Date | null | undefined, timeZone?: string | null): string {
  if (!at) return "";
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(timeZone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}`;
}

// The short zone abbreviation at an instant, e.g. "EDT", "PST".
export function zoneAbbrev(at: string | Date, timeZone?: string | null): string {
  const d = typeof at === "string" ? new Date(at) : at;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: safeZone(timeZone),
      timeZoneName: "short",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

// Format an instant in a zone. Pass Intl options; a short zone label is appended
// (e.g. "3:45 PM EDT") unless withZone is false.
export function formatInZone(
  at: string | Date | null | undefined,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  withZone = true
): string {
  if (!at) return "";
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "";
  const tz = safeZone(timeZone);
  const base = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...options }).format(d);
  if (!withZone) return base;
  const abbr = zoneAbbrev(d, tz);
  return abbr ? `${base} ${abbr}` : base;
}

export { DEFAULT_TZ };
