import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_DEPARTMENTS } from "@/lib/constants";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Public, unauthenticated application form. Reached at /apply/{org-slug} and,
// with ?embed=1, rendered bare for embedding in the restaurant's own site.
export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string; role?: string; location?: string }>;
}) {
  const { slug } = await params;
  const { embed, role, location } = await searchParams;
  const isEmbed = embed === "1";

  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("id, name, logo_url, apply_enabled")
    .eq("public_slug", slug)
    .maybeSingle();
  const org = orgRow as { id: string; name: string; logo_url: string | null; apply_enabled: boolean } | null;
  if (!org) return notFound();

  const [{ data: locs }, { data: meta }] = await Promise.all([
    admin.from("locations").select("id, name").eq("org_id", org.id).order("name"),
    admin.from("department_meta").select("department").eq("org_id", org.id),
  ]);
  const locations = (locs ?? []) as { id: string; name: string }[];
  const departments = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => (m as { department: string }).department === d));
  const roleOptions = departments.length ? departments : [...ALL_DEPARTMENTS];

  const preRole = role && roleOptions.includes(role as (typeof roleOptions)[number]) ? role : "";
  const preLocation = location && locations.some((l) => l.id === location) ? location : "";

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
      roles={roleOptions as string[]}
      preRole={preRole}
      preLocation={preLocation}
      embed={isEmbed}
    />
  );

  return (
    <div className={isEmbed ? "p-4 sm:p-6 bg-transparent" : "min-h-screen bg-paper p-4 sm:p-8"}>
      <div className="max-w-xl mx-auto">{content}</div>
    </div>
  );
}
