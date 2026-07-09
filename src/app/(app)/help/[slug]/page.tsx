import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { ARTICLES, CATEGORIES, getArticle } from "@/lib/help-content";
import { ArticleBody } from "../article-body";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const category = CATEGORIES.find((c) => c.id === article.categoryId);

  return (
    <div className="max-w-2xl w-full mx-auto">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink mb-6">
        <ArrowLeft size={15} /> All help
      </Link>

      <div className="bg-white border border-line rounded-2xl shadow-sm p-8">
        {category && <div className="text-[13px] font-semibold text-brick uppercase tracking-wide mb-2">{category.title}</div>}
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-2">{article.title}</h1>
        <p className="text-[15px] text-muted mb-6">{article.summary}</p>
        <div className="border-t border-line pt-6">
          <ArticleBody blocks={article.body} />
        </div>

        {article.links && article.links.length > 0 && (
          <div className="border-t border-line mt-8 pt-5">
            <div className="text-[13px] font-semibold text-muted-2 uppercase tracking-wide mb-3">Related</div>
            <div className="flex flex-col gap-2">
              {article.links.map((l) =>
                l.external ? (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brick hover:opacity-70"
                  >
                    {l.label} <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <Link key={l.href} href={l.href} className="text-sm font-semibold text-brick hover:opacity-70">
                    {l.label} →
                  </Link>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[13px] text-muted-2 text-center mt-6">
        Can&apos;t find what you need? Email{" "}
        <a href="mailto:hello@joinwingman.app" className="font-semibold text-brick">
          hello@joinwingman.app
        </a>
        .
      </p>
    </div>
  );
}
