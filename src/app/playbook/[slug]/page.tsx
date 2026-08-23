import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getPublishedBySlug, incrementViews, listPublished } from "@/lib/playbook";
import { isBotRequest } from "@/lib/is-bot";

export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBySlug(slug);
  if (!post) return { title: "Not found — The Playbook" };
  return {
    title: `${post.title} — The Playbook`,
    description: post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: `/playbook/${post.slug}` },
    openGraph: { title: post.title, description: post.excerpt, url: `/playbook/${post.slug}`, type: "article" },
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Render plain-text body: blank-line-separated paragraphs, with a leading
// "Bold label:" turned bold. No markdown dependency.
function renderBody(body: string) {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    const m = block.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
    if (m) return <p key={i} className="mb-5 text-[17px] leading-[1.7] text-charcoal-2"><strong className="text-ink">{m[1]}</strong> {m[2]}</p>;
    return <p key={i} className="mb-5 text-[17px] leading-[1.7] text-charcoal-2">{block}</p>;
  });
}

export default async function PlaybookArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBySlug(slug);
  if (!post) notFound();
  // Count human reads only — skip crawlers, share-link scrapers, and scripts.
  if (!(await isBotRequest())) await incrementViews(post.id);

  const more = (await listPublished()).filter((p) => p.slug !== post.slug).slice(0, 3);

  const url = `${SITE}/playbook/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        datePublished: post.publishedAt,
        dateModified: post.publishedAt,
        articleSection: post.category,
        keywords: post.keywords.join(", "),
        image: `${url}/opengraph-image`,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        author: { "@type": "Organization", name: "Wingman", url: SITE },
        publisher: { "@type": "Organization", name: "Wingman", logo: { "@type": "ImageObject", url: `${SITE}/og-image.png` } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "The Playbook", item: `${SITE}/playbook` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <MarketingNav />
      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-14 pb-20">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Link href="/playbook" className="text-[13px] font-semibold text-brick">← The Playbook</Link>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-brick mt-6 mb-2">{post.category}</div>
        <h1 className="text-[32px] sm:text-[40px] font-bold tracking-[-0.02em] text-ink leading-[1.1]">{post.title}</h1>
        <div className="text-[13.5px] text-muted-2 mt-3 mb-8">{fmtDate(post.publishedAt)}</div>
        <article>{renderBody(post.body)}</article>

        {/* CTA footer */}
        <div className="mt-12 rounded-2xl bg-ink text-white p-7">
          <div className="text-[20px] font-bold tracking-[-0.01em]">Turn this into your everyday standard.</div>
          <p className="text-white/70 mt-2 text-[15px] max-w-lg">Wingman helps restaurants train every role, run the daily habits, and turn first-time guests into regulars. See it in five minutes.</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/book-a-demo" className="inline-flex items-center rounded-full bg-white text-ink font-semibold text-[14px] px-5 py-2.5 hover:bg-white/90">Book a demo</Link>
            <Link href="/how-it-works" className="inline-flex items-center rounded-full border border-white/30 text-white font-semibold text-[14px] px-5 py-2.5 hover:bg-white/10">How it works</Link>
          </div>
        </div>

        {more.length > 0 && (
          <div className="mt-14 border-t border-line pt-8">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-4">More from The Playbook</div>
            <div className="flex flex-col gap-5">
              {more.map((p) => (
                <Link key={p.id} href={`/playbook/${p.slug}`} className="group">
                  <div className="text-[15px] font-semibold text-ink group-hover:text-brick transition-colors">{p.title}</div>
                  <div className="text-[13.5px] text-muted mt-0.5 line-clamp-2">{p.excerpt}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
