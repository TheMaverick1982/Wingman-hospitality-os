import type { Metadata } from "next";
import { ScorecardClient } from "../scorecard-client";
import { EmbedResizer } from "@/components/marketing/embed-resizer";

// The bare, chrome-less Hospitality Scorecard for embedding on a partner's site
// (framable per next.config's calcEmbedHeaders rule). Kept out of the index —
// it's the same content as the canonical /scorecard, just without the page.
export const metadata: Metadata = {
  title: "Free Hospitality Scorecard",
  robots: { index: false, follow: true },
  alternates: { canonical: "/scorecard" },
};

export default async function ScorecardEmbedPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const refCode = (ref || "").trim().replace(/[^a-zA-Z0-9_-]/g, "") || null;

  return (
    <div className="min-h-full bg-paper force-light">
      <EmbedResizer messageKey="wingmanScorecardHeight" />
      <div className="max-w-[900px] mx-auto px-4 sm:px-5 py-6">
        <ScorecardClient refCode={refCode} embed />
        {/* The visible "Powered by Wingman" link IS the backlink — a plain,
            followable <a> to the canonical page (no redirect). */}
        <div className="text-center mt-5">
          <a
            href="https://www.joinwingman.app/scorecard"
            target="_blank"
            rel="noopener"
            className="inline-block text-[12.5px] font-semibold text-muted-2 hover:text-brick transition-colors"
          >
            Powered by Wingman — the retention layer for hospitality ↗
          </a>
        </div>
      </div>
    </div>
  );
}
