import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { GhlCalendar } from "@/components/marketing/ghl-calendar";
import { WingmanMark } from "@/components/ui/wingman-mark";
import { getDemoPoolConfig, listDemoPoolMembers } from "@/lib/calendar/settings";
import { BookingWidget } from "@/components/booking/booking-widget";

// Reads live demo-pool state (which reps are in the pool, is it active) per
// request, so it can't be statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "See Wingman on your own floor. Book a 30-minute walkthrough tailored to your restaurant's concept, staffing, and guest experience gaps.",
  keywords: ["restaurant software demo", "book a demo hospitality software", "wingman demo"],
  alternates: { canonical: "/book-a-demo" },
  openGraph: {
    title: "Book a Demo | Wingman",
    description: "A 30-minute walkthrough of the real product, tailored to your concept.",
    url: "/book-a-demo",
  },
};

const POINTS = [
  "A tour of the real product, tailored to your concept",
  "How culture, training, and accountability connect",
  "What setup looks like for one location or a whole group",
  "Straight answers on pricing and rollout",
];

// The native Wingman booking widget replaces the old GoHighLevel embed. It's
// powered by the round-robin demo pool (Admin → Calendar): the config must be
// live AND at least one rep opted in. Until then, we fall back to the legacy GHL
// widget so this public page is never empty.
async function demoPoolReady(): Promise<{ durationMinutes: number } | null> {
  const [config, members] = await Promise.all([getDemoPoolConfig(), listDemoPoolMembers()]);
  if (!config.is_active || members.length === 0) return null;
  return { durationMinutes: config.meeting_duration_minutes };
}

export default async function BookADemoPage() {
  const booking = await demoPoolReady();
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-10 sm:pt-12 pb-20 sm:pb-24 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-[72px] items-start">
        <div className="pt-0 lg:pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">30-minute walkthrough</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.04] tracking-[-0.03em] font-bold text-ink mb-6">
            See Wingman on your own floor.
          </h1>
          <p className="text-lg sm:text-xl text-muted leading-[1.5] max-w-[440px] mb-10">
            Bring your toughest guest-experience gap. We&apos;ll show you exactly how Wingman would
            set and hold the standard for it.
          </p>
          <div className="flex flex-col gap-[18px] mb-10">
            {POINTS.map((p) => (
              <div key={p} className="flex gap-3.5 items-start">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brick-tint text-brick flex items-center justify-center text-[13px] mt-px">
                  ✓
                </span>
                <span className="text-[17px] text-ink leading-[1.45]">{p}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3.5 border-t border-line pt-7">
            <div className="w-11 h-11 rounded-xl bg-[#EAF1FF] flex items-center justify-center">
              <WingmanMark className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink">Hosted by the Wingman team</div>
              <div className="text-sm text-muted">Real product, your questions, no slides.</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-line rounded-3xl shadow-lg overflow-hidden p-5 sm:p-7">
          {booking ? (
            <BookingWidget slotsUrl="/api/book-demo/slots" bookUrl="/api/book-demo" durationMinutes={booking.durationMinutes} />
          ) : (
            <GhlCalendar />
          )}
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
