import Link from "next/link";
import { WingmanLogo } from "@/components/ui/wingman-logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-14 flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-3">
            <WingmanLogo className="h-4 w-auto" />
            <span className="text-sm text-muted-2">© {new Date().getFullYear()} Wingman — a The Maverick Agency company</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com/joinwingmanapp/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Wingman on Instagram"
              className="text-muted-2 hover:text-ink transition-colors"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63 19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zm0 10.16a4 4 0 110-8 4 4 0 010 8zm7.85-10.4a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/joinwingmanapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Wingman on Facebook"
              className="text-muted-2 hover:text-ink transition-colors"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="flex items-center gap-7 text-sm font-medium text-[#525252] flex-wrap">
          <Link href="/how-it-works" className="text-[#525252]">
            How it works
          </Link>
          <Link href="/guest-journey" className="text-[#525252]">
            Guest Journey
          </Link>
          <Link href="/pricing" className="text-[#525252]">
            Pricing
          </Link>
          <Link href="/playbook" className="text-[#525252]">
            The Playbook
          </Link>
          <Link href="/calculator" className="text-[#525252]">
            Calculator
          </Link>
          <Link href="/scorecard" className="text-[#525252]">
            Scorecard
          </Link>
          <Link href="/affiliates" className="text-[#525252]">
            Affiliates
          </Link>
          <Link href="/contact" className="text-[#525252]">
            Contact
          </Link>
          <Link href="/download" className="text-[#525252]">
            Get the app
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
