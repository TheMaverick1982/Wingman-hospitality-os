"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { HelpIcon } from "./help-icon";
import type { HelpArticle, HelpCategory } from "@/lib/help-content";

export function HelpBrowser({ categories, articles }: { categories: HelpCategory[]; articles: HelpArticle[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;
    const catTitle = new Map(categories.map((c) => [c.id, c.title.toLowerCase()]));
    return articles
      .map((a) => {
        const haystack = [
          a.title.toLowerCase(),
          a.summary.toLowerCase(),
          a.keywords.join(" ").toLowerCase(),
          catTitle.get(a.categoryId) ?? "",
          a.body.map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : "")).join(" ").toLowerCase(),
        ].join(" ");
        // Simple scoring: title matches rank highest.
        let score = 0;
        if (a.title.toLowerCase().includes(q)) score += 3;
        if (a.summary.toLowerCase().includes(q)) score += 2;
        if (a.keywords.some((k) => k.includes(q))) score += 2;
        if (haystack.includes(q)) score += 1;
        return { article: a, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.article);
  }, [q, articles, categories]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help — e.g. pre-shift checklist, API, invite team member"
          className="w-full rounded-xl border border-line bg-white pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-muted-2 focus:outline-none focus:border-brick"
          autoFocus
        />
      </div>

      {results ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted">
            {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query.trim()}&rdquo;
          </p>
          {results.length > 0 ? (
            results.map((a) => <ArticleRow key={a.slug} article={a} />)
          ) : (
            <p className="text-sm text-muted mt-2">
              No articles matched. Try different words, or browse the categories by clearing your search.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {categories.map((cat) => {
            const inCat = articles.filter((a) => a.categoryId === cat.id);
            if (inCat.length === 0) return null;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-9 h-9 rounded-[11px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
                    <HelpIcon name={cat.icon} size={18} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-ink">{cat.title}</div>
                    <div className="text-[13px] text-muted-2">{cat.description}</div>
                  </div>
                </div>
                <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
                  {inCat.map((a) => (
                    <ArticleRow key={a.slug} article={a} inCard />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArticleRow({ article, inCard }: { article: HelpArticle; inCard?: boolean }) {
  return (
    <Link
      href={`/help/${article.slug}`}
      className={`flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper transition-colors ${
        inCard ? "border-b border-[#F5F5F5] last:border-0" : "bg-white border border-line rounded-xl shadow-sm"
      }`}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-ink">{article.title}</div>
        <div className="text-[13px] text-muted-2 truncate">{article.summary}</div>
      </div>
      <ChevronRight size={17} className="text-muted-2 shrink-0" />
    </Link>
  );
}
