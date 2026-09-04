// Shared JobPosting (schema.org) builder for a restaurant's public job openings.
// Google's Job Posting guidelines want the markup on the most detailed leaf page
// (one job per page), so this lives on each /careers/<slug>/<opening> detail page
// — the careers hub just links to them.

export type JobOpeningLd = {
  id: string;
  department: string;
  title: string | null;
  ad_copy: string;
  pay_note: string | null;
  employment_type: string | null;
  location_id: string | null;
  created_at: string;
};
export type JobOrgLd = { name: string; logo_url: string | null };
export type JobLocLd = { id: string; name: string; address: string | null };

export const jobRoleLabel = (o: { title: string | null; department: string }) => o.title?.trim() || o.department;

// Map a free-text employment type to schema.org's enum, best-effort. A role can be
// several types (e.g. "Full-time, Part-time"), which schema.org allows as an array.
export function employmentEnums(t: string | null): string[] {
  const s = (t || "").toLowerCase();
  const out: string[] = [];
  if (s.includes("full")) out.push("FULL_TIME");
  if (s.includes("part")) out.push("PART_TIME");
  if (s.includes("contract")) out.push("CONTRACTOR");
  if (s.includes("season") || s.includes("temp")) out.push("TEMPORARY");
  if (s.includes("intern")) out.push("INTERN");
  return out;
}

const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);
const US_STATE_NAMES: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO", CONNECTICUT: "CT",
  DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
  KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI",
  MINNESOTA: "MN", MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT",
  VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC",
};

// A US state (as a 2-letter code) recognized in a text fragment, or undefined.
function stateFrom(s: string): string | undefined {
  const up = s.trim().toUpperCase();
  if (!up) return undefined;
  if (US_STATES.has(up)) return up;
  if (US_STATE_NAMES[up]) return US_STATE_NAMES[up];
  const m = up.match(/\b([A-Z]{2})\b/);
  if (m && US_STATES.has(m[1])) return m[1];
  return undefined;
}

type ParsedAddr = { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string };

// Best-effort structured split of a free-text US address into locality/region/
// postalCode, so Google's JobPosting markup gets the fields it wants. Deliberately
// CONSERVATIVE: it only emits locality/region/postalCode when it can positively
// identify a US state (2-letter code or full name) at the tail — otherwise it
// leaves the whole thing as streetAddress. Wrong structured data is worse than
// missing, so anything ambiguous stays a plain street address.
export function parseUsAddress(raw: string | null | undefined): ParsedAddr {
  const cleaned = (raw ?? "")
    .replace(/\b(?:U\.?S\.?A\.?|United States(?: of America)?)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,\s]+$/, "");
  if (!cleaned) return {};

  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    let tail = parts[parts.length - 1];
    const zip = tail.match(/\b(\d{5}(?:-\d{4})?)\b/);
    const postalCode = zip?.[1];
    if (zip) tail = tail.replace(zip[0], "").trim();
    const region = stateFrom(tail);
    if (region) {
      const cityIdx = parts.length - 2;
      const street = parts.slice(0, cityIdx).join(", ");
      return {
        ...(street ? { streetAddress: street } : {}),
        ...(parts[cityIdx] ? { addressLocality: parts[cityIdx] } : {}),
        addressRegion: region,
        ...(postalCode ? { postalCode } : {}),
      };
    }
  } else {
    // Single chunk with no commas, e.g. "Austin TX 78701".
    const m = cleaned.match(/^(.*?)[\s]+([A-Za-z]{2})[\s]+(\d{5}(?:-\d{4})?)$/);
    if (m && US_STATES.has(m[2].toUpperCase())) {
      return {
        ...(m[1].trim() ? { addressLocality: m[1].trim() } : {}),
        addressRegion: m[2].toUpperCase(),
        postalCode: m[3],
      };
    }
  }
  return { streetAddress: cleaned };
}

function place(l: JobLocLd) {
  const a = parseUsAddress(l.address);
  return {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      ...(a.streetAddress ? { streetAddress: a.streetAddress } : {}),
      ...(a.addressLocality ? { addressLocality: a.addressLocality } : {}),
      ...(a.addressRegion ? { addressRegion: a.addressRegion } : {}),
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
      addressCountry: "US",
    },
  };
}

// Best-effort baseSalary from a free-text pay note ("$18-22/hr", "$45k–55k",
// "$20/hour"). Returns a schema.org MonetaryAmount, or null when we can't read a
// number (e.g. "Competitive", "DOE") — baseSalary is optional, so we omit it
// rather than guess.
export function parsePay(payNote: string | null | undefined): Record<string, unknown> | null {
  const raw = (payNote ?? "").trim();
  if (!raw) return null;
  const s = raw.toLowerCase();

  let unitText: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" | undefined;
  if (/(per\s*hour|\/\s*hr|\/\s*hour|hourly|an hour|\bhr\b|\bhour\b)/.test(s)) unitText = "HOUR";
  else if (/(per\s*year|\/\s*yr|\/\s*year|annually|annual|\byear\b|\byr\b|salary)/.test(s)) unitText = "YEAR";
  else if (/(per\s*week|\/\s*wk|weekly|\bweek\b)/.test(s)) unitText = "WEEK";
  else if (/(per\s*month|\/\s*mo|monthly|\bmonth\b)/.test(s)) unitText = "MONTH";
  else if (/(per\s*day|\/\s*day|daily|\bday\b)/.test(s)) unitText = "DAY";

  const nums: number[] = [];
  const re = /\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    let v = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    if (m[2]) v *= 1000;
    if (v > 0) nums.push(v);
  }
  if (nums.length === 0) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!unitText) unitText = max >= 1000 ? "YEAR" : "HOUR";
  const value =
    min === max
      ? { "@type": "QuantitativeValue", value: min, unitText }
      : { "@type": "QuantitativeValue", minValue: min, maxValue: max, unitText };
  return { "@type": "MonetaryAmount", currency: "USD", value };
}

// A single JobPosting object for one opening. `site` is Wingman's origin (used for
// hiringOrganization.sameAs when the org has no site of its own on file).
export function buildJobPosting(o: JobOpeningLd, org: JobOrgLd, locations: JobLocLd[], site: string) {
  const loc = o.location_id ? locations.find((l) => l.id === o.location_id) ?? null : null;
  const empt = employmentEnums(o.employment_type);
  const jobLocation = loc ? place(loc) : locations.length ? locations.map(place) : undefined;
  const baseSalary = parsePay(o.pay_note);

  // validThrough: openings don't carry a hard expiry, but Google wants a future
  // date (a past one would read as "expired"). Only OPEN openings render this
  // page, so anchor to ~45 days after posting, floored to at least 30 days out,
  // so an open role is always valid into the future and refreshes on each render.
  const postedMs = Date.parse(o.created_at);
  const validThroughMs = Math.max(
    (Number.isFinite(postedMs) ? postedMs : Date.now()) + 45 * 86400000,
    Date.now() + 30 * 86400000,
  );

  // No "@context" here — the caller nests this inside a page-level @graph that
  // carries the context.
  return {
    "@type": "JobPosting",
    title: jobRoleLabel(o),
    description: o.ad_copy || `${jobRoleLabel(o)} position at ${org.name}.`,
    datePosted: o.created_at,
    validThrough: new Date(validThroughMs).toISOString(),
    directApply: true,
    identifier: { "@type": "PropertyValue", name: org.name, value: o.id },
    hiringOrganization: {
      "@type": "Organization",
      name: org.name,
      sameAs: site,
      ...(org.logo_url ? { logo: org.logo_url } : {}),
    },
    ...(baseSalary ? { baseSalary } : {}),
    ...(empt.length ? { employmentType: empt } : {}),
    ...(jobLocation ? { jobLocation } : {}),
  };
}
