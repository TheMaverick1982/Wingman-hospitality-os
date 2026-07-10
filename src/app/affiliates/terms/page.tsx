import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Affiliate Agreement",
  description: "The terms that govern participation in the Wingman affiliate program.",
  alternates: { canonical: "/affiliates/terms" },
};

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Agreement",
    p: [
      "This Affiliate Agreement (the “Agreement”) is between you (the “Affiliate”) and The Maverick Agency LLC, which operates Wingman (“Wingman,” “we,” or “us”). By applying to or participating in the Wingman affiliate program (the “Program”), you agree to these terms. If you do not agree, do not participate.",
      "This Agreement is separate from Wingman’s customer Terms of Service. Where you are also a Wingman customer, both apply to their respective relationships.",
    ],
  },
  {
    h: "2. Enrollment and eligibility",
    p: [
      "You must be at least 18 years old and provide accurate, complete information when you apply. Each Affiliate may hold one account.",
      "Participation begins only after we approve your application. We may accept or decline any application, and may suspend or terminate any Affiliate, at our discretion. Approval is not an endorsement or a guarantee of earnings.",
    ],
  },
  {
    h: "3. Your referral link and attribution",
    p: [
      "On approval you receive a unique referral link and code. You may share your link through channels you own or are permitted to use. You may not alter, cloak, or misrepresent your link.",
      "Referrals are tracked on a first-click basis: when a prospective customer arrives through your link, an attribution cookie is set for the window stated in your dashboard. If a prospect has already been attributed to another Affiliate, that earlier attribution stands. A given customer is credited to at most one Affiliate, and only for organizations created after the referral is captured.",
    ],
  },
  {
    h: "4. Commissions",
    p: [
      "For each referred customer who becomes a paying Wingman subscriber, you earn the commission rate stated in your dashboard, calculated as a percentage of that customer’s subscription fees, for the commission term stated in your dashboard (for example, a number of months from the customer’s first payment).",
      "Commission rates, terms, attribution windows, and minimum payout thresholds are set by us and shown in the Program materials and your dashboard. We may change them prospectively; changes do not reduce commissions already earned and approved.",
      "Commissions are calculated on net subscription revenue actually received by us, excluding taxes, fees, discounts, credits, and amounts later refunded or charged back.",
    ],
  },
  {
    h: "5. When commissions are earned and paid",
    p: [
      "A commission is initially “pending.” It becomes “approved” (payable) only after the referred customer’s second successful subscription payment, which reduces the risk of paying on signups that quickly cancel or refund.",
      "Approved commissions are paid to your PayPal account on a periodic basis once your approved balance exceeds the minimum payout threshold stated in your dashboard. You are responsible for providing a valid PayPal email; we are not liable for payouts sent to an address you provided that turns out to be incorrect.",
    ],
  },
  {
    h: "6. Refunds, chargebacks, and clawbacks",
    p: [
      "If a referred customer refunds, charges back, cancels, or otherwise reverses payments, the related commissions are voided if still pending, or deducted from your future balance if already approved or paid. A negative balance may be carried forward and offset against future commissions.",
    ],
  },
  {
    h: "7. Taxes",
    p: [
      "You are an independent party responsible for all taxes on your commissions. You agree to provide a valid Form W-9 (U.S.) or W-8BEN (non-U.S.) on request. Where required, we will issue a Form 1099 for Affiliates paid US$600 or more in a calendar year. We may withhold payouts until required tax information is provided.",
    ],
  },
  {
    h: "8. Prohibited conduct",
    p: [
      "You may not: send unsolicited or spam messages or otherwise violate anti-spam laws (including the CAN-SPAM Act); refer yourself or use your link to obtain a discount or commission on your own or affiliated accounts; generate fake, incentivized, or fraudulent signups; use cookie-stuffing, iframes, or other deceptive tracking; bid on “Wingman” or confusingly similar trademarked terms in paid search; register domains or social handles that impersonate Wingman; or make false, misleading, or unauthorized claims about Wingman, its features, pricing, or results.",
      "Violations may result in withheld or forfeited commissions and termination from the Program.",
    ],
  },
  {
    h: "9. Required disclosures",
    p: [
      "When promoting Wingman, you must clearly and conspicuously disclose your affiliate relationship as required by the U.S. Federal Trade Commission’s endorsement guidelines and any other applicable law.",
    ],
  },
  {
    h: "10. Relationship of the parties",
    p: [
      "You are an independent contractor. This Agreement does not create any employment, agency, partnership, joint venture, or franchise relationship. You have no authority to bind Wingman or to make representations on its behalf.",
    ],
  },
  {
    h: "11. Brand use and intellectual property",
    p: [
      "We grant you a limited, non-exclusive, revocable license to use the Wingman name and marketing materials we provide, solely to promote Wingman under this Agreement. You gain no other rights in our trademarks or content, and all goodwill from their use inures to us. We may revoke this license at any time.",
    ],
  },
  {
    h: "12. Term and termination",
    p: [
      "Either party may terminate this Agreement at any time, for any reason. On termination, approved commissions earned before termination remain payable, subject to the hold, clawback, tax, and threshold rules above; pending commissions may be forfeited. Commissions are forfeited entirely if we terminate you for a violation of this Agreement.",
    ],
  },
  {
    h: "13. Disclaimers and limitation of liability",
    p: [
      "The Program is provided “as is,” without warranties of any kind. We do not guarantee any level of traffic, conversions, or earnings. To the fullest extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, and our total liability under this Agreement will not exceed the commissions paid to you in the six months before the event giving rise to the claim.",
    ],
  },
  {
    h: "14. Indemnification",
    p: [
      "You will indemnify and hold harmless The Maverick Agency LLC and its affiliates from any claims, losses, or expenses (including reasonable attorneys’ fees) arising from your promotional activities, your breach of this Agreement, or your violation of any law or third-party right.",
    ],
  },
  {
    h: "15. Changes to the Program",
    p: [
      "We may modify or discontinue the Program or this Agreement at any time. Material changes take effect when posted or otherwise communicated. Your continued participation after a change constitutes acceptance of the updated terms.",
    ],
  },
  {
    h: "16. Governing law",
    p: [
      "This Agreement is governed by the laws of the State of Florida, without regard to its conflict-of-laws rules. The exclusive venue for any dispute is the state or federal courts located in Florida, and you consent to their jurisdiction.",
      "Questions about the Program can be sent to the Wingman team via your affiliate dashboard.",
    ],
  },
];

export default function AffiliateTermsPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />
      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[760px] mx-auto px-6 sm:px-10 pt-20 sm:pt-24 pb-10">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-4">
            Affiliate Agreement
          </h1>
          <p className="text-[17px] text-muted leading-[1.55]">
            These terms govern participation in the Wingman affiliate program, operated by The Maverick Agency LLC.
          </p>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-6 sm:px-10 py-14 sm:py-20 w-full">
        {SECTIONS.map((s) => (
          <div key={s.h} className="mb-9">
            <h2 className="text-2xl font-semibold tracking-[-0.015em] text-ink mb-3.5">{s.h}</h2>
            {s.p.map((para, i) => (
              <p key={i} className="text-[16px] text-charcoal-2 leading-[1.7] mb-3">
                {para}
              </p>
            ))}
          </div>
        ))}
      </div>

      <MarketingFooter />
    </div>
  );
}
