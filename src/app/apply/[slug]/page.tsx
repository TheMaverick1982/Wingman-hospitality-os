import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_DEPARTMENTS } from "@/lib/constants";
import { normalizeFormConfig } from "@/lib/application-form";
import { ApplyForm } from "./apply-form";
import { EmbedResizer } from "./embed-resizer";

// Social/link preview for the application page: use the restaurant's OWN logo and
// name (the one they uploaded for this form) instead of the generic Wingman image,
// so a shared apply link looks like the restaurant's job post — not a Wingman ad.
// Falls back to the site default only when they haven't uploaded a logo.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ opening?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { opening: openingId } = await searchParams;
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("id, name, logo_url").eq("public_slug", slug).maybeSingle();
  const org = data as { id: string; name: string; logo_url: string | null } | null;
  const images = org?.logo_url ? [{ url: org.logo_url }] : undefined;
  const card = (t: string, d: string): Metadata => ({
    title: t,
    description: d,
    robots: { index: false, follow: false },
    openGraph: { title: t, description: d, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary" : "summary_large_image", title: t, description: d, ...(images ? { images } : {}) },
  });

  // Shared from a specific opening (the /j/<code> short link redirects here with
  // ?opening=<id>) → a per-position preview: the client's logo, the role in the
  // title, and a blurb pulled from the opening's own ad copy.
  if (org && openingId) {
    const { data: opRow } = await admin
      .from("job_openings")
      .select("department, title, ad_copy, pay_note, employment_type")
      .eq("id", openingId)
      .eq("org_id", org.id)
      .maybeSingle();
    const op = opRow as { department: string; title: string | null; ad_copy: string | null; pay_note: string | null; employment_type: string | null } | null;
    if (op) {
      const role = (op.title || op.department || "team member").trim();
      const meta = [op.employment_type, op.pay_note].filter(Boolean).join(" · ");
      const blurb = (op.ad_copy || "").replace(/\s+/g, " ").trim().slice(0, 180);
      const description = [meta, blurb || `${org.name} is hiring a ${role}. Apply in a couple of minutes.`].filter(Boolean).join(" — ");
      return card(`Now hiring: ${role} — ${org.name}`, description);
    }
  }

  return org
    ? card(`Join the ${org.name} team`, `Apply to work at ${org.name}.`)
    : card("Join the team", "Apply to join the team.");
}

// Submitting grades the screening answers with an AI call, so give the route room
// past the short default function timeout.
export const maxDuration = 60;

// Public, unauthenticated application form. Reached at /apply/{org-slug} and,
// with ?embed=1, rendered bare for embedding in the restaurant's own site.
export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string; role?: string; location?: string; opening?: string; src?: string; utm_source?: string }>;
}) {
  const { slug } = await params;
  const { embed, role, location, opening, src, utm_source } = await searchParams;
  const isEmbed = embed === "1";
  // Where this applicant came from — a tagged link (?src=craigslist) or a UTM
  // param. Carried through the form so it's stored with the application.
  const source = (src ?? utm_source ?? "").toString().slice(0, 60);

  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("id, name, logo_url, apply_enabled")
    .eq("public_slug", slug)
    .maybeSingle();
  const org = orgRow as { id: string; name: string; logo_url: string | null; apply_enabled: boolean } | null;
  if (!org) return notFound();
  // Form customization lives in a column added by a later migration — read it in
  // isolation so the public form still works if that migration hasn't landed yet.
  let formConfig = normalizeFormConfig(null);
  {
    const { data: cfgRow } = await admin.from("organizations").select("application_form_config").eq("id", org.id).maybeSingle();
    if (cfgRow) formConfig = normalizeFormConfig((cfgRow as { application_form_config: unknown }).application_form_config);
  }

  const [{ data: locs }, { data: meta }] = await Promise.all([
    admin.from("locations").select("id, name").eq("org_id", org.id).order("name"),
    admin.from("department_meta").select("department").eq("org_id", org.id),
  ]);
  const locations = (locs ?? []) as { id: string; name: string }[];
  const departments = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => (m as { department: string }).department === d));
  const roleOptions = departments.length ? departments : [...ALL_DEPARTMENTS];

  // Per-role screening questions, grouped by role for role-reactive display. A
  // custom role's questions are keyed by the custom role NAME (not the "Other"
  // bucket) so they match the role the applicant actually picks. Guarded (the
  // table + custom_role column land with migrations) so the form still works if
  // they haven't applied yet — it just shows no screening step.
  const screeningByRole: Record<string, { id: string; prompt: string; required: boolean }[]> = {};
  {
    const { data: sqRows } = await admin
      .from("screening_questions")
      .select("id, department, custom_role, prompt, sort_order, required")
      .eq("org_id", org.id)
      .order("sort_order");
    for (const r of (sqRows ?? []) as { id: string; department: string; custom_role: string | null; prompt: string; required?: boolean }[]) {
      const key = r.custom_role?.trim() || r.department;
      (screeningByRole[key] ??= []).push({ id: r.id, prompt: r.prompt, required: Boolean(r.required) });
    }
  }

  // A job-opening link (?opening=<id>) pre-fills the role + location it was posted
  // for and tags the application back to that opening. Guarded: the job_openings
  // table lands with a migration, so a not-yet-applied migration just yields no
  // opening (the query returns null) and the form behaves as a plain apply link.
  let openingId: string | null = null;
  let openingRole: string | null = null;
  let openingLocation: string | null = null;
  if (opening) {
    const { data: op } = await admin
      .from("job_openings")
      .select("id, department, title, location_id, status")
      .eq("id", opening)
      .eq("org_id", org.id)
      .maybeSingle();
    const o = op as { id: string; department: string; title: string | null; location_id: string | null; status: string } | null;
    if (o && o.status === "open") {
      openingId = o.id;
      // Custom-role openings store their real role name in the title; a standard
      // role is the department. Either way this is the role the applicant is
      // applying for.
      openingRole = o.title?.trim() || o.department;
      openingLocation = o.location_id;
    }
  }

  // If this opening is for a custom role that isn't in the standard list, make it
  // selectable (and preselected) so the applicant can apply for exactly that role.
  const roleList: string[] =
    openingRole && !roleOptions.includes(openingRole as (typeof roleOptions)[number])
      ? [openingRole, ...roleOptions]
      : (roleOptions as string[]);

  const rolePick = openingRole ?? role;
  const preRole = rolePick && roleList.includes(rolePick) ? rolePick : "";
  const locPick = openingLocation ?? location;
  const preLocation = locPick && locations.some((l) => l.id === locPick) ? locPick : "";

  const content = !org.apply_enabled ? (
    <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
      <h1 className="text-[22px] font-bold text-ink mb-1">{org.name}</h1>
      <p className="text-muted text-sm">This application form isn&rsquo;t accepting submissions right now. Please check back soon.</p>
    </div>
  ) : (
    <ApplyForm
      slug={slug}
      orgName={org.name}
      logoUrl={org.logo_url}
      locations={locations}
      roles={roleList}
      preRole={preRole}
      preLocation={preLocation}
      embed={isEmbed}
      config={formConfig}
      screeningByRole={screeningByRole}
      openingId={openingId}
      source={source}
    />
  );

  return (
    <div className={isEmbed ? "p-4 sm:p-6 bg-transparent" : "min-h-screen bg-paper p-4 sm:p-8"}>
      {isEmbed && <EmbedResizer />}
      <div className="max-w-xl mx-auto">{content}</div>
    </div>
  );
}
