import Link from "next/link";

export function InlineCta({ headline, sub }: { headline: string; sub?: string }) {
  return (
    <div className="max-w-[1180px] mx-auto px-6 sm:px-10">
      <div className="bg-ink rounded-[28px] px-8 sm:px-12 py-10 sm:py-12 flex flex-col sm:flex-row items-center justify-between gap-7 text-white">
        <div className="text-center sm:text-left">
          <div className="text-xl sm:text-2xl font-semibold tracking-[-0.015em] mb-1">{headline}</div>
          {sub && <div className="text-[15px] text-[#A1A1A1]">{sub}</div>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/signup"
            className="text-[15px] font-semibold text-ink bg-white rounded-full px-6 py-3 hover:bg-[#efefef] transition-colors whitespace-nowrap"
          >
            Get Started
          </Link>
          <Link
            href="/book-a-demo"
            className="text-[15px] font-semibold text-white border border-white/25 rounded-full px-6 py-3 hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            Book a Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
