import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

const SECTIONS = [
  {
    h: "Information we collect",
    body: [
      "Account information you provide — your name, email, restaurant details, locations, and team members you invite.",
      "Operational data you create in Wingman — culture statements, training standards, sign-offs, spot-checks, checklists, and guest visit records.",
    ],
  },
  {
    h: "How we use it",
    body: [
      "To provide and improve the service: building your training system, tracking retention, and surfacing accountability insights for your team.",
      "To communicate with you about your account, security, and product updates. We do not sell your data.",
    ],
  },
  {
    h: "Guest data",
    body: [
      "Restaurants may log guest visit information to power bounce-back and retention features. That data belongs to the restaurant; Wingman processes it on their behalf and never uses it to advertise to guests.",
    ],
  },
  {
    h: "Sharing and processors",
    body: [
      "We share data only with trusted processors that help us run the service (hosting, payments, email), each bound by contract to protect it. We may disclose data if required by law.",
    ],
  },
  {
    h: "Data retention",
    body: [
      "We keep your data while your account is active. After cancellation, your data remains available to export for 30 days, then is deleted from active systems.",
    ],
  },
  {
    h: "Security",
    body: [
      "We use encryption in transit and at rest, role-based access controls, and least-privilege permissions. No system is perfectly secure, but protecting your data is a core priority.",
    ],
  },
  {
    h: "Your choices",
    body: [
      "You can access, correct, export, or delete your data from Settings, or by contacting us. Account owners control team access levels and what each role can view.",
    ],
  },
  {
    h: "Changes to this policy",
    body: [
      "We may update this policy as the product evolves. We will note the date of the latest change at the top and notify account owners of material updates.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-16 sm:pt-[88px] pb-10">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-4">Legal</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-4">
          Privacy Policy
        </h1>
        <p className="text-base text-muted-2">Last updated July 7, 2026</p>
      </div>

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-6 pb-20 sm:pb-24">
        <p className="text-lg leading-[1.6] text-charcoal-2 mb-10">
          This policy explains what Wingman collects, how we use it, and the choices you have. We
          built Wingman for hospitality teams, and we treat your restaurant&apos;s data — and your
          guests&apos; data — as something we&apos;re trusted to protect.
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
          Questions about your data? Email{" "}
          <a href="mailto:privacy@joinwingman.app" className="text-brick font-medium">
            privacy@joinwingman.app
          </a>
          .
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
