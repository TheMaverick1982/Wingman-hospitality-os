import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

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

const DOWS = ["S", "M", "T", "W", "T", "F", "S"];

type Cell = { label: string; className: string };

function buildJuly2026(): Cell[] {
  const blank = { label: "", className: "opacity-0" };
  const past = (d: number) => ({ label: String(d), className: "text-line cursor-default" });
  const weekend = (d: number) => ({ label: String(d), className: "text-line cursor-default" });
  const open = (d: number) => ({ label: String(d), className: "bg-paper text-ink cursor-pointer" });
  const selected = (d: number) => ({ label: String(d), className: "bg-brick text-white cursor-pointer" });

  const cells: Cell[] = [blank, blank, blank];
  for (let d = 1; d <= 31; d++) {
    const dow = (3 + (d - 1)) % 7;
    const isWeekend = dow === 0 || dow === 6;
    const isPast = d < 7;
    if (d === 9) cells.push(selected(d));
    else if (isPast) cells.push(past(d));
    else if (isWeekend) cells.push(weekend(d));
    else cells.push(open(d));
  }
  return cells;
}

const DAYS = buildJuly2026();

const TIMES = [
  { label: "9:00 AM", selected: false },
  { label: "10:30 AM", selected: true },
  { label: "1:00 PM", selected: false },
  { label: "2:30 PM", selected: false },
  { label: "4:00 PM", selected: false },
];

export default function BookADemoPage() {
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
            <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center text-xl font-bold">
              W
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink">Hosted by the Wingman team</div>
              <div className="text-sm text-muted">Real product, your questions, no slides.</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-line rounded-3xl shadow-lg overflow-hidden">
          <div className="bg-brick-tint text-brick-dark text-[13px] font-semibold text-center py-2.5 tracking-[0.01em]">
            Calendar placeholder — your embeddable scheduler drops in here
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-7">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[17px] font-semibold text-ink">July 2026</span>
                  <div className="flex gap-1.5">
                    <span className="w-[30px] h-[30px] rounded-lg border border-line flex items-center justify-center text-muted text-sm cursor-pointer">
                      ‹
                    </span>
                    <span className="w-[30px] h-[30px] rounded-lg border border-line flex items-center justify-center text-muted text-sm cursor-pointer">
                      ›
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DOWS.map((d, i) => (
                    <div key={i} className="text-center text-[11px] font-semibold text-muted-2">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((c, i) => (
                    <div
                      key={i}
                      className={`aspect-square flex items-center justify-center text-sm font-medium rounded-[9px] ${c.className}`}
                    >
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-ink mb-4">Thursday, July 9</div>
                <div className="flex flex-col gap-2.5">
                  {TIMES.map((t) => (
                    <div
                      key={t.label}
                      className={`text-center rounded-[10px] py-3 text-[15px] font-semibold cursor-pointer border ${
                        t.selected
                          ? "border-brick bg-brick-tint text-brick-dark"
                          : "border-line text-ink"
                      }`}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <a
              href="mailto:hello@joinwingman.app"
              className="mt-7 block w-full text-center text-base font-semibold text-white bg-brick rounded-[10px] py-3.5 hover:bg-brick-dark transition-colors"
            >
              Confirm 10:30 AM · Jul 9
            </a>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
