import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { CalculatorClient } from "./calculator-client";
import { EmbedSnippet } from "./embed-snippet";

export const metadata: Metadata = {
  title: "Retention Revenue Calculator",
  description:
    "See what lifting your repeat rate is worth. A free calculator that estimates the annual revenue you'd add by turning more first-time guests into regulars with Wingman.",
  keywords: ["restaurant retention calculator", "repeat customer revenue", "guest retention roi", "restaurant revenue calculator"],
  alternates: { canonical: "/calculator" },
  openGraph: {
    title: "Retention Revenue Calculator | Wingman",
    description: "See what lifting your repeat rate is worth for your restaurant.",
    url: "/calculator",
  },
};

export default function CalculatorPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-24 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">Free calculator</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[72px] leading-[1.0] tracking-[-0.035em] font-bold text-ink mx-auto mb-6 max-w-[820px]">
            What are your regulars worth?
          </h1>
          <p className="text-lg sm:text-[22px] leading-[1.5] text-muted mx-auto max-w-[620px]">
            Drag the slider to see the revenue you&apos;d add by turning more first-time guests into regulars — the exact
            thing Wingman is built to do.
          </p>
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[1080px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
          <CalculatorClient />
          <p className="text-center text-[13px] text-muted-2 mt-8 max-w-[640px] mx-auto">
            Estimates use your own numbers — the added revenue is the value of the extra visits from first-timers you
            convert into regulars. Actual results depend on your execution; Wingman gives your team the system to get there.
          </p>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
        <h2 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-6">
          Turn the number into reality.
        </h2>
        <p className="text-lg sm:text-[21px] text-muted leading-[1.5] max-w-[540px] mx-auto mb-10">
          Wingman builds the culture, training, and follow-up that keep guests coming back — live on your first shift.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a href="/signup" className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors">Get Started</a>
          <a href="/book-a-demo" className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors">Book a Demo</a>
        </div>
      </div>

      <div className="bg-paper border-t border-line">
        <div className="max-w-[1080px] mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <EmbedSnippet />
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
