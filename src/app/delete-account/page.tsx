import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to request deletion of your Wingman account and associated personal data.",
  alternates: { canonical: "/delete-account" },
  openGraph: {
    title: "Delete your account | Wingman",
    description: "How to request deletion of your Wingman account and associated personal data.",
    url: "/delete-account",
  },
};

const SECTIONS = [
  {
    h: "How to request deletion",
    body: [
      "In the app: an account owner or Super Admin can remove a team member from Settings → Team & permissions, which deletes that person's login and personal profile.",
      "For your whole account: email us from the address on your account and we'll delete your account and its associated personal data. Send your request to hello@joinwingman.app with the subject \"Delete my account,\" and include your restaurant name so we can locate the account.",
    ],
  },
  {
    h: "What gets deleted",
    body: [
      "Your account and login, your name, email, and phone number, and the personal profile tied to your user — including your training records, sign-offs, and checklist completions.",
      "When an account owner deletes the whole organization, all of the organization's data is removed from our active systems.",
    ],
  },
  {
    h: "What we may keep, and for how long",
    body: [
      "We keep limited records we're required to retain for legal, tax, or fraud-prevention reasons (for example, billing history), for as long as the law requires, after which they're deleted.",
      "Guest visit information logged for bounce-back and retention belongs to the restaurant, not to Wingman. When an organization is deleted, that data is removed with it.",
      "Backups are purged on a rolling schedule; any residual copies are deleted within 30 days of your request.",
    ],
  },
  {
    h: "How long it takes",
    body: [
      "We process deletion requests within 30 days. We'll confirm by email once your account and associated personal data have been deleted.",
    ],
  },
];

export default function DeleteAccountPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-16 sm:pt-[88px] pb-10">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-4">Your data</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-4">
          Delete your account
        </h1>
        <p className="text-base text-muted-2">Last updated July 14, 2026</p>
      </div>

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-6 pb-20 sm:pb-24">
        <p className="text-lg leading-[1.6] text-charcoal-2 mb-10">
          You can delete your Wingman account and its associated personal data at any time. This page
          explains how to request deletion, what&apos;s removed, and what we&apos;re required to keep.
          Wingman is operated by The Maverick Agency.
        </p>
        {SECTIONS.map((s) => (
          <div key={s.h} className="border-t border-line py-8">
            <h2 className="text-2xl font-semibold tracking-[-0.015em] text-ink mb-3.5">{s.h}</h2>
            {s.body.map((p) => (
              <p key={p} className="text-base leading-[1.6] text-charcoal-2 mb-3.5 last:mb-0">
                {p}
              </p>
            ))}
          </div>
        ))}
        <div className="border-t border-line pt-8 text-base text-charcoal-2 leading-[1.6]">
          To request deletion, email{" "}
          <a href="mailto:hello@joinwingman.app?subject=Delete%20my%20account" className="text-brick font-medium">
            hello@joinwingman.app
          </a>
          .
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
