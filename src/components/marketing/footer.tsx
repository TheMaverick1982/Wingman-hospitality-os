import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-14 flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-[7px] bg-ink flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-[13px]">W</span>
          </span>
          <span className="text-sm text-muted-2">© {new Date().getFullYear()} Wingman</span>
        </div>
        <div className="flex items-center gap-7 text-sm font-medium text-[#525252] flex-wrap">
          <Link href="/how-it-works" className="text-[#525252]">
            How it works
          </Link>
          <Link href="/pricing" className="text-[#525252]">
            Pricing
          </Link>
          <Link href="/login" className="text-[#525252]">
            Log in
          </Link>
          <Link href="/signup" className="text-[#525252]">
            Get Started
          </Link>
          <Link href="/privacy" className="text-[#525252]">
            Privacy
          </Link>
          <Link href="/terms" className="text-[#525252]">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
