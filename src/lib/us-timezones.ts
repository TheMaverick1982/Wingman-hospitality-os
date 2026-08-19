// The store time-zone options shown when adding/editing a location, plus a
// best-effort auto-detector from a free-text US address. One source of truth for
// both the add-location and edit-location forms.

export const US_TIMEZONES = [
  ["America/New_York", "Eastern (New York)"],
  ["America/Chicago", "Central (Chicago)"],
  ["America/Denver", "Mountain (Denver)"],
  ["America/Phoenix", "Mountain – no DST (Phoenix)"],
  ["America/Los_Angeles", "Pacific (Los Angeles)"],
  ["America/Anchorage", "Alaska (Anchorage)"],
  ["Pacific/Honolulu", "Hawaii (Honolulu)"],
] as const;

export const DEFAULT_US_TIMEZONE = "America/New_York";

const TZ_VALUES = new Set<string>(US_TIMEZONES.map(([v]) => v));

// Dominant time zone per US state (straddle states use their most-populous zone;
// the dropdown lets an operator correct an edge city like the FL panhandle).
const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Denver", IL: "America/Chicago", IN: "America/New_York", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

// Guess an IANA time zone from a free-text address. Tries "…, ST 12345" first
// (most reliable), then a bare 2-letter state token, then a spelled-out state
// name. Returns null when nothing recognizable is found.
export function guessTimezoneFromAddress(address: string): string | null {
  if (!address) return null;
  const upper = ` ${address.toUpperCase()} `;

  // 1) State code immediately before a 5-digit ZIP: "Denver, CO 80202".
  const beforeZip = upper.match(/[,\s]([A-Z]{2})\s+\d{5}/);
  if (beforeZip && STATE_TZ[beforeZip[1]]) return STATE_TZ[beforeZip[1]];

  // 2) Any standalone 2-letter state token.
  const codes = upper.match(/\b[A-Z]{2}\b/g) ?? [];
  for (let i = codes.length - 1; i >= 0; i--) {
    if (STATE_TZ[codes[i]]) return STATE_TZ[codes[i]];
  }

  // 3) Spelled-out state name.
  const lower = address.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) return STATE_TZ[code];
  }
  return null;
}

// The viewer's own browser zone, but only if it's one of the offered options
// (so it can seed a <select>); otherwise the Eastern default.
export function browserTimezoneOrDefault(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_VALUES.has(tz)) return tz;
  } catch {
    // ignore
  }
  return DEFAULT_US_TIMEZONE;
}
