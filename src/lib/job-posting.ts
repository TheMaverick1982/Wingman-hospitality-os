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

function place(l: JobLocLd) {
  return {
    "@type": "Place",
    address: { "@type": "PostalAddress", ...(l.address ? { streetAddress: l.address } : {}), addressCountry: "US" },
  };
}

// A single JobPosting object for one opening. `site` is Wingman's origin (used for
// hiringOrganization.sameAs when the org has no site of its own on file).
export function buildJobPosting(o: JobOpeningLd, org: JobOrgLd, locations: JobLocLd[], site: string) {
  const loc = o.location_id ? locations.find((l) => l.id === o.location_id) ?? null : null;
  const empt = employmentEnums(o.employment_type);
  const jobLocation = loc ? place(loc) : locations.length ? locations.map(place) : undefined;
  // No "@context" here — the caller nests this inside a page-level @graph that
  // carries the context.
  return {
    "@type": "JobPosting",
    title: jobRoleLabel(o),
    description: o.ad_copy || `${jobRoleLabel(o)} position at ${org.name}.`,
    datePosted: o.created_at,
    directApply: true,
    identifier: { "@type": "PropertyValue", name: org.name, value: o.id },
    hiringOrganization: {
      "@type": "Organization",
      name: org.name,
      sameAs: site,
      ...(org.logo_url ? { logo: org.logo_url } : {}),
    },
    ...(empt.length ? { employmentType: empt } : {}),
    ...(jobLocation ? { jobLocation } : {}),
  };
}
