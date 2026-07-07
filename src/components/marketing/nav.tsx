import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/72 backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-[#ededed]">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between px-10 h-[60px]">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] rounded-lg bg-ink flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">W</span>
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Wingman</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/how-it-works" className="text-sm font-medium text-ink hidden sm:inline">
            How it works
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-ink hidden sm:inline">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-medium text-[#525252]">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-ink rounded-full px-[18px] py-[9px] hover:bg-black transition-colors"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
