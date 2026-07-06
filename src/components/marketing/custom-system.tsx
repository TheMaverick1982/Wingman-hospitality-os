import { CheckCircle2 } from "lucide-react";

const YOU_TELL_US = [
  "Your concept and price point",
  "What great guest experience actually looks like at your place",
  "The #1 gap you see right now, from guests or staff",
  "Your top guest experience priorities",
  "Any signature touch or ritual you already do",
];

const WE_BUILD = [
  "A culture statement in your voice, not generic corporate language",
  "Five core values, specific to how you actually want guests treated",
  "Department-by-department training for Host, Server, Bartender, Chef, and Manager",
  "Hiring guidance matched to those same values, so you screen for the right people",
  "Accountability tools — spot-checks, daily checklists — ready to use on shift one",
];

export function CustomSystem() {
  return (
    <section className="bg-white py-24 px-6 border-t border-line">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-4">
            Not a generic training binder.
            <br />
            Your standard.
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Every restaurant says &quot;great service&quot; means something different. Wingman asks a
            few sharp questions about yours, then builds the entire hospitality system around the
            answer — culture, training, and accountability, all specific to your concept.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-paper border border-line rounded-2xl p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-5">You tell us</p>
            <ul className="flex flex-col gap-4">
              {YOU_TELL_US.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-charcoal-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brick mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-charcoal rounded-2xl p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#98989d] mb-5">We build</p>
            <ul className="flex flex-col gap-4">
              {WE_BUILD.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#f5f5f7]">
                  <CheckCircle2 size={16} className="text-olive shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
