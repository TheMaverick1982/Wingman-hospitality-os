import type { Metadata } from "next";
import Link from "next/link";
import { WingmanLogo } from "@/components/ui/wingman-logo";

export const metadata: Metadata = {
  title: "Wingman — Links",
  description: "Guest retention for restaurants. Try the demo, run your numbers, or book a call.",
};

// Link-in-bio page for Instagram / social profiles. Standalone (no marketing
// nav/footer) and mobile-first — big tap targets, one column.
const LINKS: { href: string; label: string; sub?: string; primary?: boolean; external?: boolean }[] = [
  { href: "/demo", label: "Try the live demo", sub: "See it running on an example restaurant — no signup", primary: true },
  { href: "/calculator", label: "Calculate your retention upside", sub: "What lifting your repeat rate is worth" },
  { href: "/scorecard", label: "Take the Hospitality Scorecard", sub: "Score your operation in 2 minutes" },
  { href: "/book-a-demo", label: "Book a 20-min call with Brian", sub: "Walk through your numbers, no slides" },
  { href: "/how-it-works", label: "How Wingman works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/signup", label: "Get started" },
];

export default function LinksPage() {
  return (
    <main className="min-h-screen bg-paper flex flex-col items-center px-5 py-12">
      <div className="w-full max-w-[440px] flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <WingmanLogo className="h-6 w-auto" />
          <p className="text-[15px] text-muted leading-relaxed max-w-[320px]">
            Guest retention for restaurants — turn first-time guests into regulars, every shift.
          </p>
        </div>

        <nav className="w-full flex flex-col gap-3">
          {LINKS.map((l) => {
            const cls = l.primary
              ? "bg-brick text-white border-brick hover:bg-brick-dark"
              : "bg-white text-ink border-line hover:border-brick";
            const inner = (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-[16px] font-semibold ${l.primary ? "text-white" : "text-ink"}`}>{l.label}</div>
                  {l.sub && <div className={`text-[13px] mt-0.5 ${l.primary ? "text-white/85" : "text-muted"}`}>{l.sub}</div>}
                </div>
                <span className={`text-[18px] shrink-0 ${l.primary ? "text-white/90" : "text-muted-2"}`}>→</span>
              </div>
            );
            return l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={`block rounded-2xl border px-5 py-4 shadow-sm transition-colors ${cls}`}>
                {inner}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className={`block rounded-2xl border px-5 py-4 shadow-sm transition-colors ${cls}`}>
                {inner}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-5">
          <a href="https://www.instagram.com/joinwingmanapp/" target="_blank" rel="noopener noreferrer" aria-label="Wingman on Instagram" className="text-muted-2 hover:text-ink transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63 19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zm0 10.16a4 4 0 110-8 4 4 0 010 8zm7.85-10.4a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
            </svg>
          </a>
          <a href="https://www.facebook.com/joinwingmanapp" target="_blank" rel="noopener noreferrer" aria-label="Wingman on Facebook" className="text-muted-2 hover:text-ink transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
            </svg>
          </a>
          <a href="https://www.joinwingman.app" className="text-muted-2 hover:text-ink transition-colors" aria-label="Wingman website">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 010 20 15.3 15.3 0 010-20z" />
            </svg>
          </a>
        </div>

        <p className="text-[12px] text-muted-2">© {new Date().getFullYear()} Wingman</p>
      </div>
    </main>
  );
}
