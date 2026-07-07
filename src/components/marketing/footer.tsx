import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="bg-paper py-10 px-6 border-t border-line">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between text-sm text-muted">
        <span>© {new Date().getFullYear()} Wingman</span>
        <div className="flex items-center gap-6">
          <Link href="/how-it-works" className="hover:text-ink transition-colors">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-ink transition-colors">
            Pricing
          </Link>
          <Link href="/book-a-demo" className="hover:text-ink transition-colors">
            Book a demo
          </Link>
          <Link href="/privacy" className="hover:text-ink transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink transition-colors">
            Terms
          </Link>
          <Link href="/login" className="hover:text-ink transition-colors">
            Log in
          </Link>
        </div>
      </div>
    </footer>
  );
}
