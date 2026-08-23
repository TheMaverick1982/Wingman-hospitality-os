import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Talk to the Wingman team about guest retention, staff training, and hiring for your restaurant — book a demo, ask a question, or get help getting set up.",
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact | Wingman", description: "Talk to the Wingman team about guest retention, staff training, and hiring for your restaurant.", url: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div className="max-w-[720px] w-full mx-auto px-6 sm:px-10 pt-14 sm:pt-[72px] pb-20 sm:pb-24">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-4">Contact</div>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-4">
          Talk to us
        </h1>
        <p className="text-lg text-muted leading-[1.5] mb-9 max-w-[520px]">
          Questions about Wingman, a demo, or your account? Send us a note using the form below and we&apos;ll
          get right back to you.
        </p>

        <ContactForm />
      </div>

      <MarketingFooter />
    </div>
  );
}
