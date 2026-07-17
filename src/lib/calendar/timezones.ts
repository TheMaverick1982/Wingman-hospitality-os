// Time-zone list for the booking pickers. We surface the full IANA set (via
// Intl.supportedValuesOf) so hosts and guests anywhere in the world can pick
// their zone — not just the US. Each entry is [ianaId, label] where the label
// carries the current UTC offset for scannability, e.g.
//   ["America/New_York", "(GMT-04:00) America/New York"]
// Entries are sorted by offset, then name.

// Fallback for runtimes without Intl.supportedValuesOf (older engines). Kept
// broad so the picker is still usable if the full list can't be enumerated.
const FALLBACK_ZONES = [
  "Pacific/Midway", "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
  "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York",
  "America/Halifax", "America/Sao_Paulo", "Atlantic/Azores", "UTC",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Athens",
  "Africa/Johannesburg", "Europe/Moscow", "Asia/Dubai", "Asia/Karachi",
  "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

function allZones(): string[] {
  const withValues = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof withValues.supportedValuesOf === "function") {
    try {
      const zones = withValues.supportedValuesOf("timeZone");
      if (Array.isArray(zones) && zones.length) return zones;
    } catch {
      // fall through
    }
  }
  return FALLBACK_ZONES;
}

// Current UTC offset (minutes) for a zone — used to sort and to label.
function offsetMinutes(timeZone: string, now: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const map: Record<string, string> = {};
    for (const p of dtf.formatToParts(now)) map[p.type] = p.value;
    const asUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return Math.round((asUTC - now.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function offsetLabel(offset: number): string {
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `GMT${sign}${hh}:${mm}`;
}

function buildTimezones(): [string, string][] {
  const now = new Date();
  return allZones()
    .map((tz) => ({ tz, off: offsetMinutes(tz, now) }))
    .sort((a, b) => a.off - b.off || a.tz.localeCompare(b.tz))
    .map(({ tz, off }) => [tz, `(${offsetLabel(off)}) ${tz.replace(/_/g, " ")}`] as [string, string]);
}

export const BOOKING_TIMEZONES: readonly (readonly [string, string])[] = buildTimezones();

const VALID = new Set(BOOKING_TIMEZONES.map(([v]) => v));

export function isValidTimeZone(tz: string): boolean {
  if (VALID.has(tz)) return true;
  // Accept any IANA zone the runtime recognizes (belt and suspenders).
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
