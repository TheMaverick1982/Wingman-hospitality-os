import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_DEPARTMENTS } from "@/lib/constants";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

type Org = { id: string; name: string; logo_url: string | null; apply_enabled: boolean };
type Opening = {
  id: string;
  department: string;
  location_id: string | null;
  title: string | null;
  ad_copy: string;
  pay_note: string | null;
  employment_type: string | null;
  created_at: string;
};
type Loc = { id: string; name: string; address: string | null };

async function loadOrg(slug: string): Promise<Org | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id, name, logo_url, apply_enabled")
    .eq("public_slug", slug)
    .maybeSingle();
  return (data as Org | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const org = await loadOrg(slug);
  if (!org) return { title: "Careers", robots: { index: false, follow: false } };
  const title = `Careers at ${org.name} — Now Hiring`;
  const description = `See open positions at ${org.name} and apply in minutes. Roles by location, updated as we hire.`;
  return {
    title,
    description,
    alternates: { canonical: `/careers/${slug}` },
    openGraph: { title, description, url: `/careers/${slug}`, type: "website" },
  };
}

const usds = (s: string | null) => (s ? s.trim() : "");
const roleLabel = (o: Opening) => (o.title?.trim() || o.department);
// Map a free-text employment type to schema.org's enum, best-effort.
function employmentEnum(t: string | null): string | null {
  const s = (t || "").toLowerCase();
  if (s.includes("full")) return "FULL_TIME";
  if (s.includes("part")) return "PART_TIME";
  if (s.includes("contract")) return "CONTRACTOR";
  if (s.includes("season") || s.includes("temp")) return "TEMPORARY";
  if (s.includes("intern")) return "INTERN";
  return null;
}

export default async function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await loadOrg(slug);
  if (!org) return notFound();

  const admin = createAdminClient();
  const [{ data: opRows }, { data: locRows }] = await Promise.all([
    admin
      .from("job_openings")
      .select("id, department, location_id, title, ad_copy, pay_note, employment_type, created_at")
      .eq("org_id", org.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    admin.from("locations").select("id, name, address").eq("org_id", org.id).order("name"),
  ]);
  const openings = ((opRows ?? []) as Opening[]).filter((o) => ALL_DEPARTMENTS.includes(o.department as (typeof ALL_DEPARTMENTS)[number]));
  const locations = (locRows ?? []) as Loc[];
  const locById = new Map(locations.map((l) => [l.id, l]));
  const isMulti = locations.length > 1;

  // Group openings by location; a null location_id means "All locations".
  const groups: { key: string; name: string; items: Opening[] }[] = [];
  const pushInto = (key: string, name: string, o: Opening) => {
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, name, items: [] }; groups.push(g); }
    g.items.push(o);
  };
  for (const o of openings) {
    if (o.location_id && locById.has(o.location_id)) pushInto(o.location_id, locById.get(o.location_id)!.name, o);
    else pushInto("all", isMulti ? "All locations" : "", o);
  }
  // Specific locations first (alphabetical), "All locations" last.
  groups.sort((a, b) => (a.key === "all" ? 1 : b.key === "all" ? -1 : a.name.localeCompare(b.name)));

  const applyHref = (o: Opening) => `/apply/${slug}?opening=${o.id}&src=careers`;

  // JobPosting structured data → eligibility for the Google Jobs listing.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": openings.map((o) => {
      const loc = o.location_id ? locById.get(o.location_id) : null;
      const place = (l: Loc) => ({
        "@type": "Place",
        address: { "@type": "PostalAddress", ...(l.address ? { streetAddress: l.address } : {}), addressCountry: "US" },
      });
      const empt = employmentEnum(o.employment_type);
      return {
        "@type": "JobPosting",
        title: roleLabel(o),
        description: o.ad_copy || `${roleLabel(o)} position at ${org.name}.`,
        datePosted: o.created_at,
        directApply: true,
        hiringOrganization: {
          "@type": "Organization",
          name: org.name,
          sameAs: SITE,
          ...(org.logo_url ? { logo: org.logo_url } : {}),
        },
        ...(empt ? { employmentType: empt } : {}),
        jobLocation: loc ? place(loc) : locations.length ? locations.map(place) : undefined,
      };
    }),
  };

  return (
    <div className="min-h-full bg-paper force-light">
      {openings.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="max-w-[820px] mx-auto px-5 sm:px-8 py-12 sm:py-16">
        {/* Branded header */}
        <div className="flex items-center gap-3 mb-8">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-11 w-11 rounded-xl object-cover border border-line" />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-ink text-white flex items-center justify-center text-lg font-bold">{org.name.charAt(0)}</div>
          )}
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-brick">Now hiring</div>
            <h1 className="text-[26px] sm:text-[32px] font-bold tracking-[-0.02em] text-ink leading-tight">Careers at {org.name}</h1>
          </div>
        </div>

        {!org.apply_enabled ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
            <p className="text-[15px] text-ink font-semibold mb-1">Applications are paused right now.</p>
            <p className="text-sm text-muted">Please check back soon — we&rsquo;d still love to hear from you.</p>
          </div>
        ) : openings.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-10 text-center shadow-sm">
            <p className="text-[15px] text-ink font-semibold mb-1">No open positions at the moment.</p>
            <p className="text-sm text-muted">Check back soon — new roles are posted here as they open.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-9">
            <p className="text-[16px] text-muted leading-relaxed -mt-2">
              Here&rsquo;s everything we&rsquo;re hiring for right now{isMulti ? ", by location" : ""}. Tap a role to apply — it takes a couple of minutes.
            </p>
            {groups.map((g) => (
              <section key={g.key}>
                {g.name && (
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-3">{g.name}</h2>
                )}
                <div className="flex flex-col gap-3">
                  {g.items.map((o) => (
                    <div key={o.id} className="bg-white border border-line rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[17px] font-semibold text-ink">{roleLabel(o)}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[13px] text-muted-2">
                          {o.employment_type && <span className="font-medium">{o.employment_type}</span>}
                          {o.employment_type && usds(o.pay_note) && <span>·</span>}
                          {usds(o.pay_note) && <span className="font-medium text-charcoal-2">{usds(o.pay_note)}</span>}
                        </div>
                        {o.ad_copy?.trim() && (
                          <p className="text-[14px] text-muted leading-relaxed mt-2.5 line-clamp-3">{o.ad_copy.trim()}</p>
                        )}
                      </div>
                      <a
                        href={applyHref(o)}
                        className="shrink-0 self-start inline-flex items-center justify-center text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
                      >
                        Apply
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="text-center mt-12 text-[12.5px] text-muted-2">
          Hiring powered by{" "}
          <a href={SITE} target="_blank" rel="noopener" className="font-semibold text-muted hover:text-brick">Wingman</a>
        </div>
      </div>
    </div>
  );
}
