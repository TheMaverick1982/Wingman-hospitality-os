import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { listPublished } from "@/lib/playbook";

export const metadata: Metadata = {
  title: "The Playbook — Actionable advice for restaurant operators",
  description: "Real, actionable plays on guest retention, hiring, training, and running a restaurant that keeps its people and its regulars. From the team behind Wingman.",
  keywords: ["restaurant operations blog", "guest retention tips", "restaurant hiring advice", "restaurant training ideas", "restaurant management playbook"],
  alternates: { canonical: "/playbook" },
  openGraph: { title: "The Playbook | Wingman", description: "Actionable plays for restaurant operators, from the team behind Wingman.", url: "/playbook" },
};

// Rendered at request time (reads the DB). Cached briefly at the edge.
export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function PlaybookIndex() {
  const posts = await listPublished();
  const [featured, ...rest] = posts;

  return (
    <>
      <MarketingNav />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-16 pb-24">
        <header className="mb-12">
          <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-brick mb-3">The Playbook</div>
          <h1 className="text-[38px] sm:text-[46px] font-bold tracking-[-0.02em] text-ink leading-[1.05] max-w-2xl">Plays for operators who want their guests to come back.</h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">Actionable advice on retention, hiring, training, and running a restaurant that keeps its people and its regulars. No fluff.</p>
        </header>

        {posts.length === 0 ? (
          <div className="text-muted">New plays are on the way. Check back soon.</div>
        ) : (
          <>
            {featured && (
              <Link href={`/playbook/${featured.slug}`} className="block group border-b border-line pb-10 mb-10">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-brick mb-2">{featured.category}</div>
                <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.01em] text-ink group-hover:text-brick transition-colors leading-tight max-w-3xl">{featured.title}</h2>
                <p className="text-[17px] text-muted mt-3 max-w-2xl">{featured.excerpt}</p>
                <div className="text-[13px] text-muted-2 mt-3">{fmtDate(featured.publishedAt)}</div>
              </Link>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
              {rest.map((p) => (
                <Link key={p.id} href={`/playbook/${p.slug}`} className="group">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-1.5">{p.category}</div>
                  <h3 className="text-[19px] font-semibold text-ink leading-snug group-hover:text-brick transition-colors">{p.title}</h3>
                  <p className="text-[14.5px] text-muted mt-2 line-clamp-3">{p.excerpt}</p>
                  <div className="text-[12.5px] text-muted-2 mt-2">{fmtDate(p.publishedAt)}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
