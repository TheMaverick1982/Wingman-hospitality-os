import Link from "next/link";
import { TwoOutcomesChart } from "./two-outcomes-chart";
import { HeroRetentionGraphic } from "./hero-retention-graphic";

export function Hero() {
  return (
    <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-16 sm:pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1.14fr_0.86fr] gap-10 lg:gap-[52px] items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-brick-tint text-brick-dark text-[13px] font-semibold tracking-[0.01em] px-[14px] py-[6px] rounded-full mb-7">
              <span className="w-[7px] h-[7px] rounded-full bg-brick" />
              The retention layer for hospitality
            </span>
            <h1 className="font-display text-[32px] sm:text-[44px] lg:text-[56px] font-bold tracking-[-0.03em] text-ink leading-[1.02] mb-7">
              The guest you already won is your best marketing channel.
            </h1>
            <p className="text-lg sm:text-xl leading-[1.5] text-muted max-w-[520px] mb-10">
              Wingman turns every first visit into a second, third, and tenth — with the culture,
              training, and accountability system that makes teams deliver on it, every single
              shift.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/demo"
                className="text-[17px] font-semibold text-white bg-brick rounded-full px-[30px] py-[15px] hover:bg-brick-dark transition-colors"
              >
                Try it live →
              </Link>
              <Link
                href="/signup"
                className="text-[17px] font-semibold text-brick hover:text-brick-dark transition-colors px-3 py-[15px]"
              >
                Get Started
              </Link>
              <Link href="/book-a-demo" className="text-[17px] font-semibold text-brick hover:text-brick-dark transition-colors px-3 py-[15px]">
                Book a Demo →
              </Link>
            </div>
          </div>

          <HeroRetentionGraphic />
        </div>

        <div className="pt-16 sm:pt-[88px]">
          <TwoOutcomesChart />
        </div>
      </div>
    </div>
  );
}
