import Link from "next/link";
import { RotateCcw, TrendingUp, Heart } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 px-6">
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-brick) 0%, var(--color-olive) 45%, transparent 70%)",
        }}
      />
      <div className="relative max-w-4xl mx-auto text-center">
        <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-ink leading-[1.05]">
          The guest you already won
          <br />
          is your best marketing channel.
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
          Wingman turns every first visit into a second, third, and tenth — with the culture,
          training, and accountability system that makes hospitality teams actually deliver on it,
          every single shift.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="text-base font-semibold text-white bg-charcoal rounded-full px-7 py-3.5 hover:opacity-80 transition-opacity"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="text-base font-semibold text-brick rounded-full px-7 py-3.5 hover:opacity-70 transition-opacity"
          >
            Log in →
          </Link>
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto mt-16 grid grid-cols-3 gap-4">
        <div className="bg-panel border border-line rounded-2xl p-5 shadow-sm">
          <RotateCcw size={18} className="text-brick mb-3" />
          <div className="font-mono text-2xl font-semibold text-ink">62%</div>
          <div className="text-xs text-muted mt-1">of first-time guests brought back for visit 2</div>
        </div>
        <div className="bg-panel border border-line rounded-2xl p-5 shadow-sm">
          <TrendingUp size={18} className="text-olive mb-3" />
          <div className="font-mono text-2xl font-semibold text-ink">2.1%</div>
          <div className="text-xs text-muted mt-1">discount rate, down from a 7% baseline</div>
        </div>
        <div className="bg-panel border border-line rounded-2xl p-5 shadow-sm">
          <Heart size={18} className="text-gold mb-3" />
          <div className="font-mono text-2xl font-semibold text-ink">128</div>
          <div className="text-xs text-muted mt-1">culture moments recognized this quarter</div>
        </div>
      </div>
    </section>
  );
}
