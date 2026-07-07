import { CalendarClock } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export default function BookADemoPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MarketingNav />
      <section className="pt-20 pb-24 px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="font-display text-[40px] sm:text-[56px] font-bold tracking-[-0.03em] text-ink leading-[1.05]">
            Book a demo.
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed">
            15 minutes to walk through Wingman with your restaurant in mind — no pressure, no
            script.
          </p>
        </div>

        <div className="max-w-lg mx-auto bg-panel border border-line rounded-2xl p-10 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mx-auto mb-5">
            <CalendarClock size={22} className="text-brick" />
          </div>
          <p className="text-sm font-semibold text-ink mb-2">Scheduler coming soon</p>
          <p className="text-sm text-muted leading-relaxed">
            This is a placeholder — a real booking calendar will be embedded here shortly. In the
            meantime, email us and we&apos;ll find a time that works.
          </p>
          <a
            href="mailto:hello@joinwingman.app"
            className="inline-block mt-6 text-sm font-semibold text-white bg-charcoal rounded-full px-6 py-3 hover:opacity-80 transition-opacity"
          >
            hello@joinwingman.app
          </a>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
