import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="bg-paper py-10 px-6 border-t border-line">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between text-sm text-muted">
        <span>© {new Date().getFullYear()} Wingman</span>
        <div className="flex items-center gap-6">
          <Link href="/login" className="hover:text-ink transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="hover:text-ink transition-colors">
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}
