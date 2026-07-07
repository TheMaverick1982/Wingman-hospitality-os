import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-panel/80 border-b border-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold text-lg tracking-tight text-ink">
          Wingman
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-ink hover:text-brick transition-colors">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-charcoal rounded-full px-4 py-2 hover:opacity-80 transition-opacity"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
