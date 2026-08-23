import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOpeningRole } from "@/lib/constants";
import { buildJobPosting, jobRoleLabel, type JobOpeningLd, type JobLocLd } from "@/lib/job-posting";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

type Org = { id: string; name: string; logo_url: string | null; apply_enabled: boolean };

async function load(slug: string, openingId: string) {
  const admin = createAdminClient();
  const { data: orgData } = await admin
    .from("organizations")
    .select("id, name, logo_url, apply_enabled")
    .eq("public_slug", slug)
    .maybeSingle();
  const org = (orgData as Org | null) ?? null;
  if (!org) return { org: null, opening: null, location: null };

  const { data: opData } = await admin
    .from("job_openings")
    .select("id, department, location_id, title, ad_copy, pay_note, employment_type, created_at, status")
    .eq("id", openingId)
    .eq("org_id", org.id)
    .maybeSingle();
  const op = opData as (JobOpeningLd & { status: string }) | null;
  // Only an open, valid-role opening gets an indexable detail page.
  if (!op || op.status !== "open" || !isOpeningRole(op.department)) return { org, opening: null, location: null };

  let location: JobLocLd | null = null;
  if (op.location_id) {
    const { data: locData } = await admin.from("locations").select("id, name, address").eq("id", op.location_id).eq("org_id", org.id).maybeSingle();
    location = (locData as JobLocLd | null) ?? null;
  }
  return { org, opening: op, location };
}

// UUID guard so a junk path 404s instead of hitting the DB.
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function generateMetadata({ params }: { params: Promise<{ slug: string; opening: string }> }): Promise<Metadata> {
  const { slug, opening } = await params;
  if (!isUuid(opening)) return { title: "Careers", robots: { index: false, follow: false } };
  const { org, opening: op } = await load(slug, opening);
  if (!org || !op) return { title: "Careers", robots: { index: false, follow: false } };
  const role = jobRoleLabel(op);
  const title = `${role} — ${org.name} Careers`;
  const description = (op.ad_copy?.trim() || `${role} position at ${org.name}. Apply in minutes.`).replace(/\s+/g, " ").slice(0, 180);
  return {
    title,
    description,
    alternates: { canonical: `/careers/${slug}/${op.id}` },
    openGraph: { title, description, url: `/careers/${slug}/${op.id}`, type: "website" },
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string; opening: string }> }) {
  const { slug, opening } = await params;
  if (!isUuid(opening)) return notFound();
  const { org, opening: op, location } = await load(slug, opening);
  if (!org || !op) return notFound();

  const role = jobRoleLabel(op);
  const applyHref = `/apply/${slug}?opening=${op.id}&src=careers`;
  // The canonical JobPosting for Google Jobs lives here, on the leaf page.
  const jsonLd = buildJobPosting(op, org, location ? [location] : [], SITE);

  return (
    <div className="min-h-full bg-paper force-light">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-[720px] mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <Link href={`/careers/${slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brick mb-8">
          <ArrowLeft size={15} /> All open roles at {org.name}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-11 w-auto max-w-[200px] object-contain" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-ink text-white flex items-center justify-center text-lg font-bold">{org.name.charAt(0)}</div>
          )}
          <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-brick">Now hiring</div>
        </div>

        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] text-ink leading-tight">{role}</h1>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-[14px] text-muted-2">
          <span className="inline-flex items-center gap-1"><MapPin size={14} />{location ? location.name : "All locations"}</span>
          {op.employment_type && <span>· <span className="font-medium">{op.employment_type}</span></span>}
          {op.pay_note?.trim() && <span>· <span className="font-medium text-charcoal-2">{op.pay_note.trim()}</span></span>}
        </div>

        <a href={applyHref} className="mt-6 inline-flex items-center justify-center text-[15px] font-semibold text-white bg-brick rounded-full px-7 py-3 hover:bg-brick-dark transition-colors">
          Apply for this role
        </a>

        {op.ad_copy?.trim() && (
          <div className="mt-8 text-[15px] text-ink leading-relaxed whitespace-pre-line">{op.ad_copy.trim()}</div>
        )}

        <div className="mt-10 pt-6 border-t border-line">
          <a href={applyHref} className="inline-flex items-center justify-center text-[15px] font-semibold text-white bg-brick rounded-full px-7 py-3 hover:bg-brick-dark transition-colors">
            Apply for this role
          </a>
        </div>

        <div className="text-center mt-12 text-[12.5px] text-muted-2">
          Hiring powered by{" "}
          <a href={SITE} target="_blank" rel="noopener" className="font-semibold text-muted hover:text-brick">Wingman</a>
        </div>
      </div>
    </div>
  );
}
