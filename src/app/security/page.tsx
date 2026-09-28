import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Security & Privacy",
  description: "How Wingman protects your restaurant's data and your guests' data — tenant isolation, encryption, access controls, and our approach to compliance.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Security & Privacy | Wingman",
    description: "How Wingman protects your restaurant's data and your guests' data — tenant isolation, encryption, access controls, and our approach to compliance.",
    url: "/security",
  },
};

const SECTIONS = [
  {
    h: "Your data is isolated by restaurant",
    body: [
      "Wingman is multi-tenant: every restaurant's data is scoped to its own organization and enforced at the database level with row-level security, so one account can never see another's guests, staff, reviews, or standards.",
      "Access inside your account is role-based. Owners control what each manager, shift lead, and team member can see, and can hide individual sections from specific people. Permissions are checked on every page and every action, not just hidden in the interface.",
    ],
  },
  {
    h: "Encryption",
    body: [
      "All data is encrypted in transit (HTTPS/TLS) between your devices and Wingman, and encrypted at rest in our database and file storage.",
    ],
  },
  {
    h: "Secrets and integrations stay server-side",
    body: [
      "When you connect an outside service — Square, Clover, your Google Business Profile, or a payment method — the access tokens and credentials are stored in locked-down tables that the browser can never read. Every use happens in our secure server environment.",
      "Integrations request the minimum access needed. For example, the Google Business Profile connection is read-only: Wingman reads your reviews to summarize them for you, and never posts, edits, or deletes anything. You can disconnect any integration at any time.",
      "Payment details are handled by our PCI-compliant payment processor; Wingman never stores full card numbers.",
    ],
  },
  {
    h: "We protect against accidental data loss",
    body: [
      "Deleting a guest, team member, or partner is a soft delete: the record moves to an owner-only Trash where it can be restored, rather than being erased. Sensitive changes are recorded in an audit trail.",
      "Database changes are additive by design and pass automated safety checks before they ship, so an update can't silently drop your data. Our database is backed up on an ongoing basis by our infrastructure provider.",
    ],
  },
  {
    h: "Your data belongs to you",
    body: [
      "The data you and your guests put into Wingman is yours. We process it to run the service on your behalf — we do not sell it, and we do not use your guests' information to advertise to them.",
      "You can export or delete your data from Settings, or by contacting us. After cancellation, your data remains available to export for 30 days, then is removed from active systems. Full detail is in our Privacy Policy.",
    ],
  },
  {
    h: "Built on trusted infrastructure",
    body: [
      "Wingman runs on leading cloud infrastructure providers (including Vercel and Supabase) that maintain their own SOC 2 / ISO 27001 certifications and operate in secure, access-controlled data centers. We rely on a small set of vetted sub-processors (hosting, database, email, payments, and AI processing), each bound by contract to protect your data.",
    ],
  },
  {
    h: "Compliance & certifications",
    body: [
      "Wingman is built to align with SOC 2 principles — the access controls, encryption, tenant isolation, and auditing described above are the foundation those frameworks look for. We are not independently SOC 2 or ISO 27001 certified today, and we're happy to discuss a formal certification timeline for enterprise and multi-unit agreements.",
      "HIPAA: Wingman is a hospitality product. It is designed for restaurant operations, guest retention, hiring, and team culture — it does not collect or process protected health information, so HIPAA does not apply.",
      "If your organization has a specific security questionnaire or requirement, reach out and we'll work through it with you.",
    ],
  },
  {
    h: "Reporting a security concern",
    body: [
      "If you believe you've found a security issue, please email us right away at security@joinwingman.app. We take every report seriously and will respond promptly.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-16 sm:pt-[88px] pb-10">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-4">Trust</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-4">
          Security &amp; Privacy
        </h1>
        <p className="text-base text-muted-2">Last updated September 28, 2026</p>
      </div>

      <div className="max-w-[820px] mx-auto px-6 sm:px-10 pt-6 pb-20 sm:pb-24">
        <p className="text-lg leading-[1.6] text-charcoal-2 mb-10">
          Restaurants trust Wingman with their team&apos;s and their guests&apos; information, and we
          treat that as something we&apos;re responsible to protect. This page explains, in plain
          language, how we keep your data safe and private. For the full detail on what we collect and
          your choices, see our{" "}
          <a href="/privacy" className="text-brick font-medium">Privacy Policy</a>. Wingman is operated
          by The Maverick Agency.
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
          Security or privacy questions? Email{" "}
          <a href="mailto:security@joinwingman.app" className="text-brick font-medium">
            security@joinwingman.app
          </a>
          .
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
