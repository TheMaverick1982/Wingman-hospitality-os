import type { Metadata } from "next";
import { CalculatorClient } from "../calculator-client";
import { EmbedResizer } from "@/components/marketing/embed-resizer";

// The bare, chrome-less calculator for embedding on a partner's site (framable
// per next.config's calcEmbedHeaders). Kept out of the index — it's the same
// content as the canonical /calculator, just without the page around it.
export const metadata: Metadata = {
  title: "Retention Revenue Calculator",
  robots: { index: false, follow: true },
  alternates: { canonical: "/calculator" },
};

export default async function CalculatorEmbedPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const refCode = (ref || "").trim().replace(/[^a-zA-Z0-9_-]/g, "") || null;

  return (
    <div className="min-h-full bg-paper force-light">
      <EmbedResizer messageKey="wingmanCalcHeight" />
      <div className="max-w-[1080px] mx-auto px-4 sm:px-5 py-6">
        <CalculatorClient refCode={refCode} embed />
        {/* The visible "Powered by Wingman" link IS the backlink — a plain,
            followable <a> to the canonical page (no redirect), so it passes link
            equity cleanly. */}
        <div className="text-center mt-5">
          <a
            href="https://www.joinwingman.app/calculator"
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
