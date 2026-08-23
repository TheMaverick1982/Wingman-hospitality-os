import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOpeningRole } from "@/lib/constants";
import { CareersOpenings } from "./careers-openings";
import { EmbedResizer } from "@/components/marketing/embed-resizer";

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
type Loc = { id: string; name: string };

async function loadOrg(slug: string): Promise<Org | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id, name, logo_url, apply_enabled")
    .eq("public_slug", slug)
    .maybeSingle();
  return (data as Org | null) ?? null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const embed = (await searchParams)?.embed === "1";
  const org = await loadOrg(slug);
  if (!org) return { title: "Careers", robots: { index: false, follow: false } };
  const title = `Careers at ${org.name} — Now Hiring`;
  const description = `See open positions at ${org.name} and apply in minutes. Roles by location, updated as we hire.`;
  return {
    title,
    description,
    // The ?embed=1 copy lives inside a customer's iframe — keep it out of the
    // index so it isn't ranked as a duplicate; the canonical careers page is what
    // Google should surface (and carries the JobPosting markup).
    ...(embed ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical: `/careers/${slug}` },
    openGraph: { title, description, url: `/careers/${slug}`, type: "website" },
  };
}

export default async function CareersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { slug } = await params;
  const embed = (await searchParams)?.embed === "1";
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
    admin.from("locations").select("id, name").eq("org_id", org.id).order("name"),
  ]);
  const openings = ((opRows ?? []) as Opening[]).filter((o) => isOpeningRole(o.department));
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

  // Per Google's Job Posting guidelines, the JobPosting structured data lives on
  // each role's own detail page (/careers/<slug>/<opening>) — the "leaf" page —
  // not on this list/hub page. This page just links to them.

  // Breadcrumb rich result: Home → Careers at <org>. Skipped in embed mode.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: `Careers at ${org.name}`, item: `${SITE}/careers/${slug}` },
    ],
  };

  return (
    <div className={`bg-paper force-light ${embed ? "" : "min-h-full"}`}>
      {/* Embedded on a customer's own site — post height up so their iframe sizes to fit. */}
      {embed && <EmbedResizer messageKey="wingmanCareersHeight" />}
      {!embed && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />}
      <div className={`max-w-[820px] mx-auto px-5 sm:px-8 ${embed ? "py-6 sm:py-8" : "py-12 sm:py-16"}`}>
        {/* Branded header */}
        <div className="flex items-center gap-3 mb-8">
          {org.logo_url ? (
            // Fixed height, auto width, object-contain — show the whole logo
            // (wordmarks included) without cropping it into a square.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-12 w-auto max-w-[220px] object-contain" />
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
          <CareersOpenings slug={slug} groups={groups} isMulti={isMulti} />
        )}

        <div className="text-center mt-12 text-[12.5px] text-muted-2">
          Hiring powered by{" "}
          <a href={SITE} target="_blank" rel="noopener" className="font-semibold text-muted hover:text-brick">Wingman</a>
        </div>
      </div>
    </div>
  );
}
