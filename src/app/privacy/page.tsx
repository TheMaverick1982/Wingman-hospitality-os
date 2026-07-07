import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export default function PrivacyPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MarketingNav />
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-[40px] font-bold tracking-[-0.03em] text-ink mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted mb-2">Last updated: July 2026</p>
          <div className="bg-gold-tint border border-gold/30 rounded-xl p-4 mb-10 text-sm text-[#92400e]">
            Placeholder legal copy — have an attorney review and finalize this before publishing it
            live.
          </div>

          <div className="flex flex-col gap-10 text-[15px] text-charcoal-2 leading-relaxed">
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">1. Information we collect</h2>
              <p>
                We collect account information (name, email, organization and location details),
                operational data you enter into Wingman (guest records, training sign-offs,
                accountability logs, hiring notes), and standard usage/log data. If you use Google
                sign-in, we receive your name, email, and profile photo from Google.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">2. How we use it</h2>
              <p>
                We use this information to provide and improve Wingman, to send you service and
                billing communications, and to generate the reports and analytics your account
                requests. We do not sell your data.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">3. Data sharing</h2>
              <p>
                We share data with service providers who help us run Wingman — hosting (Vercel),
                database and auth (Supabase), payment processing, and email delivery — solely to
                provide the service. Data within your organization is only visible to members of
                that organization, scoped by their access level.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">4. Data security</h2>
              <p>
                Your organization&apos;s data is isolated at the database level using row-level
                security, so no other organization can read or write it. Data is encrypted in
                transit.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">5. Your rights</h2>
              <p>
                You can request an export or deletion of your organization&apos;s data at any time
                by contacting us. Account owners can export data for 30 days after canceling a
                subscription.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">6. Changes to this policy</h2>
              <p>
                We&apos;ll post any changes to this page and update the date above. Material
                changes will be communicated to account owners by email.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">7. Contact</h2>
              <p>
                Questions about this policy: <span className="text-ink font-medium">privacy@joinwingman.app</span>
              </p>
            </div>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
