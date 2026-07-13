import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getPlatformPricing, applyPriceTokens } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Wingman.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Wingman",
    description: "The terms that govern your use of Wingman.",
    url: "/terms",
  },
};

const SECTIONS = [
  {
    h: "Using Wingman",
    body: [
      "You may use Wingman to run your restaurant's culture, training, accountability, and retention operations. You're responsible for your account, your team's activity, and the accuracy of the data you enter.",
      "You agree not to misuse the service, attempt to breach its security, or use it to violate any law or the rights of others.",
    ],
  },
  {
    h: "Accounts and access levels",
    body: [
      "The account owner (Super Admin) controls locations, billing, and what Managers and Staff can view. You're responsible for keeping login credentials secure and for the actions taken under your account.",
    ],
  },
  {
    h: "Subscription and billing",
    body: [
      "Wingman is billed monthly: {{firstPrice}} for your first location and {{addlPrice}} per additional location. Adding a location increases your subscription immediately, prorated to the current period.",
      "Fees are charged to your payment method on file at the start of each billing period and are non-refundable except where required by law.",
      "Wingman is operated and billed by The Maverick Agency. Charges appear on your bank or card statement as \"The Maverick Agency.\"",
    ],
  },
  {
    h: "Failed payments and account suspension",
    body: [
      "If a payment fails, we'll email you and ask you to update your payment method in Settings → Billing. Your account stays active during a grace period while we retry the charge.",
      "If the balance remains unpaid and your payment method isn't updated within 30 days, we may suspend and then close your account. After closure your data may be permanently deleted, and The Maverick Agency is not responsible for any resulting loss of data. Please export anything you need before then.",
    ],
  },
  {
    h: "Cancellations and refunds",
    body: [
      "You can cancel any time from Settings → Billing. There is no notice period and no cancellation fee. Cancellation takes effect at the end of your current billing period — your plan stays fully active until then, after which access ends.",
      "Wingman is billed one month at a time, and your subscription renews on the same day each month (the anniversary of your signup). To avoid the next charge, cancel before that renewal date. Once a new billing period begins, that month's fee has already been charged.",
      "Fees already charged are non-refundable, and we do not provide partial or prorated refunds for unused time, except where a refund is required by law. Any goodwill exception we choose to make is at our sole discretion and does not waive this policy.",
      "Removing a location takes effect at your next renewal; the current period is not refunded or prorated. (Adding a location increases your subscription immediately, prorated to the current period, as described above.)",
      "After cancellation, your data is available to export for 30 days. Please export anything you need before then.",
    ],
  },
  {
    h: "Your content",
    body: [
      "You own the content and data you put into Wingman. You grant us the limited right to host and process it solely to provide the service to you.",
    ],
  },
  {
    h: "Availability",
    body: [
      "We work to keep Wingman available and reliable, but the service is provided \"as is\" without warranties. We aren't liable for indirect or consequential damages to the extent permitted by law.",
    ],
  },
  {
    h: "Acceptable use",
    body: [
      "Don't upload unlawful content, infringe others' rights, or attempt to disrupt or reverse-engineer the service. We may suspend accounts that violate these terms.",
    ],
  },
  {
    h: "Changes to these terms",
    body: [
      "We may update these terms as the product changes. We'll post the latest date at the top and notify account owners of material changes. Continued use means you accept the updated terms.",
    ],
  },
];

export default async function TermsPage() {
  const pricing = await getPlatformPricing();
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-16 sm:pt-[88px] pb-10">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-4">Legal</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-4">
          Terms of Service
        </h1>
        <p className="text-base text-muted-2">Last updated July 10, 2026</p>
      </div>

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-6 pb-20 sm:pb-24">
        <p className="text-lg leading-[1.6] text-charcoal-2 mb-10">
          These terms govern your use of Wingman. By creating an account or using the service, you
          agree to them. We&apos;ve kept them as plain as we can. Wingman is a product of The Maverick
          Agency, which operates and provides the service.
        </p>
        {SECTIONS.map((s) => (
          <div key={s.h} className="border-t border-line py-8">
            <h2 className="text-2xl font-semibold tracking-[-0.015em] text-ink mb-3.5">{s.h}</h2>
            {s.body.map((p) => (
              <p key={p} className="text-base leading-[1.6] text-charcoal-2 mb-3.5 last:mb-0">
                {applyPriceTokens(p, pricing)}
              </p>
            ))}
          </div>
        ))}
        <div className="border-t border-line pt-8 text-base text-charcoal-2 leading-[1.6]">
          Questions about these terms? Email{" "}
          <a href="mailto:hello@joinwingman.app" className="text-brick font-medium">
            hello@joinwingman.app
          </a>
          .
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
