import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/playbook";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app";

// Regenerate at runtime so published posts are included (the DB isn't reachable
// at build time).
export const dynamic = "force-dynamic";

const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/book-a-demo", priority: 0.8, changeFrequency: "monthly" },
  { path: "/playbook", priority: 0.8, changeFrequency: "weekly" },
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
  return [...base, ...posts];
}
