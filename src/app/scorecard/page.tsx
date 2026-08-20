import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { ScorecardClient } from "./scorecard-client";
import { EmbedSnippet } from "@/components/marketing/embed-snippet";

export const metadata: Metadata = {
  title: "Free Hospitality Scorecard",
  description:
    "Grade your restaurant's guest-retention operation in 2 minutes. Answer 10 quick questions and get your Hospitality Score plus your three biggest opportunities.",
  keywords: ["restaurant hospitality assessment", "guest retention audit", "restaurant scorecard", "hospitality health check"],
  alternates: { canonical: "/scorecard" },
  openGraph: {
    title: "Free Hospitality Scorecard | Wingman",
    description: "Grade your restaurant's guest-retention operation in 2 minutes.",
    url: "/scorecard",
  },
};

export default function ScorecardPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-24 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">Free · 2 minutes</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[72px] leading-[1.0] tracking-[-0.035em] font-bold text-ink mx-auto mb-6 max-w-[820px]">
            How strong is your guest retention?
          </h1>
          <p className="text-lg sm:text-[22px] leading-[1.5] text-muted mx-auto max-w-[600px]">
            Ten quick questions. Get your Hospitality Score and the three things that would move the needle most.
          </p>
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[900px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
          <ScorecardClient />
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
        <h2 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-6">
          Close every gap with one system.
        </h2>
        <p className="text-lg sm:text-[21px] text-muted leading-[1.5] max-w-[540px] mx-auto mb-10">
          Wingman turns your scorecard into a plan your team runs every shift.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a href="/signup" className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors">Get Started</a>
          <a href="/calculator" className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors">Try the revenue calculator</a>
        </div>
        <p className="text-[14px] text-muted mt-6">
          The economics behind the score:{" "}
          <a href="/state-of-restaurant-retention" className="font-semibold text-brick hover:text-brick-dark">The State of Restaurant Guest Retention →</a>
        </p>
      </div>

      <div className="bg-paper border-t border-line">
        <div className="max-w-[1080px] mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <EmbedSnippet toolName="scorecard" embedPath="/scorecard/embed" iframeTitle="Free Restaurant Hospitality Scorecard" messageKey="wingmanScorecardHeight" heightDefault={900} />
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
