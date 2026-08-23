import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/playbook";
import { createAdminClient } from "@/lib/supabase/admin";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app";

// Regenerate at runtime so published posts are included (the DB isn't reachable
// at build time).
export const dynamic = "force-dynamic";

const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  // Top-of-funnel lead-gen pages — the ones people search for and convert on.
  { path: "/calculator", priority: 0.8, changeFrequency: "monthly" },
  { path: "/scorecard", priority: 0.8, changeFrequency: "monthly" },
  { path: "/state-of-restaurant-retention", priority: 0.8, changeFrequency: "monthly" },
  { path: "/guest-journey", priority: 0.8, changeFrequency: "monthly" },
  { path: "/book-a-demo", priority: 0.8, changeFrequency: "monthly" },
  // Use-case / "system" landing pages — one per keyword cluster.
  { path: "/restaurant-hiring-software", priority: 0.9, changeFrequency: "monthly" },
  { path: "/guest-retention-software", priority: 0.9, changeFrequency: "monthly" },
  { path: "/restaurant-training-software", priority: 0.9, changeFrequency: "monthly" },
  { path: "/restaurant-review-management", priority: 0.9, changeFrequency: "monthly" },
  { path: "/restaurant-revenue-growth", priority: 0.9, changeFrequency: "monthly" },
  { path: "/affiliates", priority: 0.6, changeFrequency: "monthly" },
  { path: "/api-guide", priority: 0.5, changeFrequency: "monthly" },
  { path: "/playbook", priority: 0.8, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/download", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ROUTES.map((r) => ({
    url: `${siteUrl}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
  let posts: MetadataRoute.Sitemap = [];
  try {
    posts = (await listPublished()).map((p) => ({
      url: `${siteUrl}/playbook/${p.slug}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    /* sitemap should still render without posts */
  }

  // Public hiring pages for orgs that are actively hiring: a public slug, an
  // enabled application form, and at least one OPEN opening. We list both the
  // careers hub (/careers/<slug>) and each open role's own detail page
  // (/careers/<slug>/<opening>) — the leaf pages carry the JobPosting markup, so
  // listing them is what actually feeds the Google Jobs results box. Guarded so a
  // DB hiccup never breaks the whole sitemap.
  let careers: MetadataRoute.Sitemap = [];
  try {
    const admin = createAdminClient();
    const [{ data: orgRows }, { data: openRows }] = await Promise.all([
      admin.from("organizations").select("id, public_slug").not("public_slug", "is", null).eq("apply_enabled", true),
      admin.from("job_openings").select("id, org_id, created_at").eq("status", "open"),
    ]);
    // Slug per eligible org.
    const slugByOrg = new Map<string, string>();
    for (const o of (orgRows ?? []) as { id: string; public_slug: string | null }[]) {
      if (o.public_slug) slugByOrg.set(o.id, o.public_slug);
    }
    const opens = ((openRows ?? []) as { id: string; org_id: string; created_at: string }[]).filter((o) => slugByOrg.has(o.org_id));

    // Careers hub per org, dated to its most recent open role.
    const lastOpenByOrg = new Map<string, number>();
    for (const o of opens) {
      const t = new Date(o.created_at).getTime();
      if (!lastOpenByOrg.has(o.org_id) || t > (lastOpenByOrg.get(o.org_id) as number)) lastOpenByOrg.set(o.org_id, t);
    }
    const hubs: MetadataRoute.Sitemap = [...lastOpenByOrg].map(([orgId, t]) => ({
      url: `${siteUrl}/careers/${slugByOrg.get(orgId)}`,
      lastModified: new Date(t),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
    // One entry per open role — the indexable JobPosting detail pages.
    const roles: MetadataRoute.Sitemap = opens.map((o) => ({
      url: `${siteUrl}/careers/${slugByOrg.get(o.org_id)}/${o.id}`,
      lastModified: new Date(o.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    careers = [...hubs, ...roles];
  } catch {
    /* sitemap should still render without careers pages */
  }

  return [...base, ...posts, ...careers];
}
