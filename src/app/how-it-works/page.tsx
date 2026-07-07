import Link from "next/link";
import { RotateCcw, Receipt, GraduationCap, AlertTriangle, type LucideIcon } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

const SECTIONS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: RotateCcw,
    title: "Guest Bounce Back",
    body: "Log every first-time guest and the incentive that brought them back. Track the journey from visit 1 through loyal regular, shared across every location — a guest who's a regular at one spot is a first-timer at another, so retention gets tracked org-wide.",
  },
  {
    icon: Receipt,
    title: "Service Recovery",
    body: "Every comp and discount gets a reason attached. Recurring issues surface automatically — a wait-time complaint that's come up three times this week doesn't stay buried in a spreadsheet, it becomes a coaching flag.",
  },
  {
    icon: GraduationCap,
    title: "Training & Standards",
    body: "Department-specific hospitality standards and technical training, with a real sign-off log. Servers and bartenders get menu-driven training — upload your menu and Wingman builds pairing, allergen, and upsell training around it automatically.",
  },
  {
    icon: AlertTriangle,
    title: "Accountability",
    body: "Spot-checks, daily manager checklists, and pre-shift hospitality checks mean coaching happens in real time. When something needs attention, Wingman gives your managers a State → Story → Strategy coaching playbook, not just a red flag.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MarketingNav />
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-[40px] sm:text-[56px] font-bold tracking-[-0.03em] text-ink leading-[1.05] text-balance">
            One system for the whole guest experience.
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Wingman connects the four things that actually decide whether a guest comes back —
            tracked automatically, not managed in spreadsheets and sticky notes.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-[1180px] mx-auto flex flex-col gap-16">
          {SECTIONS.map((s, i) => (
            <div
              key={s.title}
              className={`flex flex-col md:flex-row gap-8 items-start ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
            >
              <div className="flex-1 bg-panel border border-line rounded-2xl p-10 shadow-sm w-full">
                <div className="w-11 h-11 rounded-full bg-brick-tint flex items-center justify-center mb-5">
                  <s.icon size={20} className="text-brick" />
                </div>
                <h2 className="text-[22px] font-semibold text-ink mb-3">{s.title}</h2>
                <p className="text-[15px] text-muted leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-paper py-20 px-6 text-center border-t border-line">
        <h2 className="font-display text-[30px] font-bold text-ink mb-4">Ready to see it running your way?</h2>
        <p className="text-muted mb-8">Set up takes minutes — no credit card required to start.</p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="text-base font-semibold text-white bg-charcoal rounded-full px-7 py-3.5 hover:opacity-80 transition-opacity"
          >
            Get started free
          </Link>
          <Link
            href="/book-a-demo"
            className="text-base font-semibold text-brick rounded-full px-7 py-3.5 hover:opacity-70 transition-opacity"
          >
            Book a demo →
          </Link>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
