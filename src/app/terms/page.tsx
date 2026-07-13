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
    h: "Service availability and interruptions",
    body: [
      "We work hard to keep Wingman available, but we do not guarantee that the service will be uninterrupted, timely, secure, or error-free. Access may be unavailable from time to time — for scheduled maintenance, updates, or circumstances outside our reasonable control such as outages, server or network failures, or problems with the third-party providers the service depends on.",
      "We are not responsible or liable for any interruption, delay, downtime, suspension, or discontinuation of the service, or for any resulting inability to access your data during those periods. We do not provide any uptime guarantee or service-level commitment unless one is agreed with you separately in writing.",
    ],
  },
  {
    h: "Third-party services and infrastructure",
    body: [
      "Wingman runs on third-party infrastructure and services — including cloud hosting, database, email delivery, analytics, and payment-processing providers. We don't control these providers, and their outages, failures, changes, or discontinuations can affect the service. We are not responsible or liable for the acts, omissions, downtime, or failures of any third-party provider, or for any loss or damage arising from them.",
    ],
  },
  {
    h: "Data, backups, and export",
    body: [
      "You are responsible for keeping your own copies of any data that matters to you. While we take reasonable measures to protect and back up data, we do not warrant that data will never be lost, corrupted, or unavailable, and we are not liable for any loss of or damage to your data, however caused. You can export your data at any time from within the app, and we encourage you to do so regularly.",
    ],
  },
  {
    h: "AI features and content",
    body: [
      "Wingman uses artificial intelligence to help generate training, tests, guest-experience, hiring, and other content and suggestions. AI-generated output can be inaccurate, incomplete, or unsuitable for your situation. You are responsible for reviewing and editing any AI-generated content before relying on it or sharing it with your team, guests, or applicants. We are not liable for any decision made or action taken in reliance on AI-generated content.",
    ],
  },
  {
    h: "Not professional advice",
    body: [
      "Wingman and its content are provided for general operational and informational purposes only. They are not legal, employment, human-resources, tax, financial, or other professional advice. You are solely responsible for your own compliance with all laws and regulations that apply to your business — including employment, wage-and-hour, food-safety, privacy, and marketing laws. Consult a qualified professional where you need advice.",
    ],
  },
  {
    h: "Disclaimer of warranties",
    body: [
      "TO THE FULLEST EXTENT PERMITTED BY LAW, WINGMAN IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITH ALL FAULTS AND WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. THE MAVERICK AGENCY DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, AVAILABLE, ACCURATE, SECURE, OR ERROR-FREE.",
    ],
  },
  {
    h: "Limitation of liability",
    body: [
      "TO THE FULLEST EXTENT PERMITTED BY LAW, THE MAVERICK AGENCY AND ITS OWNERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, GOODWILL, OR DATA, ARISING OUT OF OR RELATING TO YOUR USE OF (OR INABILITY TO USE) THE SERVICE — INCLUDING ANY DOWNTIME OR INTERRUPTION — EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
      "TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE AMOUNT YOU PAID US FOR THE SERVICE IN THE THREE (3) MONTHS IMMEDIATELY BEFORE THE EVENT GIVING RISE TO THE CLAIM.",
      "Some jurisdictions do not allow certain limitations, so some of the above may not apply to you; in that case our liability is limited to the smallest amount permitted by law.",
    ],
  },
  {
    h: "Events beyond our control (force majeure)",
    body: [
      "We are not liable for any failure or delay in providing the service caused by events beyond our reasonable control — including internet, hosting, utility, or telecommunications failures; third-party provider outages; cyberattacks; natural disasters; fire or flood; labor disputes; pandemics; or acts of government.",
    ],
  },
  {
    h: "Indemnification",
    body: [
      "You agree to indemnify and hold harmless The Maverick Agency from any claims, losses, or expenses (including reasonable legal fees) arising from your content, your use of the service, your violation of these terms, or your violation of any law or the rights of any third party.",
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
        <p className="text-base text-muted-2">Last updated July 13, 2026</p>
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
