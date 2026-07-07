import { RotateCcw, TrendingUp, ClipboardCheck, MapPin, type LucideIcon } from "lucide-react";

const PROPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: RotateCcw,
    title: "Repeat guests are your most profitable ones",
    body: "A guest who comes back spends more, forgives more, and tells their friends for free. Wingman tracks every guest's visit lifecycle — first visit through loyal regular — so no bounce-back opportunity slips through.",
  },
  {
    icon: TrendingUp,
    title: "Make every marketing dollar work twice as hard",
    body: "Most of what you spend on ads and promotions goes toward winning a guest once. Wingman is the retention layer underneath it — turning the guests you already paid to bring in the door into guests who keep coming back on their own.",
  },
  {
    icon: ClipboardCheck,
    title: "Standards your team actually keeps",
    body: "Department training, real-time sign-offs, and spot-checks that measure whether service felt like a transaction or an experience — so hospitality isn't left to chance, shift after shift.",
  },
  {
    icon: MapPin,
    title: "One system, every location",
    body: "General Managers see everything across every location. Store Managers stay focused on their own floor. Built-in permissions mean everyone sees exactly what they need — nothing more, nothing less.",
  },
];

export function ValueProps() {
  return (
    <section className="bg-paper py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-center text-ink mb-16 tracking-tight">
          Guest experience isn&apos;t a poster on the wall.
          <br />
          It&apos;s a system.
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {PROPS.map((p) => (
            <div key={p.title} className="bg-panel border border-line rounded-2xl p-8">
              <div className="w-10 h-10 rounded-full bg-brick-tint flex items-center justify-center mb-5">
                <p.icon size={18} className="text-brick" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">{p.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
