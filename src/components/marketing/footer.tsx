import Link from "next/link";
import { WingmanMark } from "@/components/ui/wingman-mark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-14 flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <WingmanMark className="w-5 h-5 text-brick shrink-0" />
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
