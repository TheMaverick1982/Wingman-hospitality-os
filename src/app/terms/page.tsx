import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export default function TermsPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MarketingNav />
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-[40px] font-bold tracking-[-0.03em] text-ink mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted mb-2">Last updated: July 2026</p>
          <div className="bg-gold-tint border border-gold/30 rounded-xl p-4 mb-10 text-sm text-[#92400e]">
            Placeholder legal copy — have an attorney review and finalize this before publishing it
            live.
          </div>

          <div className="flex flex-col gap-10 text-[15px] text-charcoal-2 leading-relaxed">
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">1. Acceptance of terms</h2>
              <p>
                By creating a Wingman account, you agree to these terms on behalf of yourself and
                the organization you represent.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">2. Accounts & access levels</h2>
              <p>
                The person who creates an organization is its Super Admin. Super Admins can invite
                Managers and Staff and assign their access level and location. Each person is
                responsible for activity under their own login.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">3. Subscription & billing</h2>
              <p>
                Wingman is billed monthly per location: $199/mo for a single location, or $199/mo
                for your first location plus $100/mo for each additional location on the
                multi-location plan. Adding a location updates your subscription immediately,
                prorated for the remainder of the billing cycle.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">4. Cancellation</h2>
              <p>
                You can cancel at any time from Settings → Billing. Your organization keeps access
                through the end of the current billing period, and you can export your data for 30
                days after that.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">5. Acceptable use</h2>
              <p>
                Don&apos;t use Wingman to store data you don&apos;t have the right to store, attempt
                to access another organization&apos;s data, or use the service in a way that
                disrupts it for other customers.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">6. Data ownership</h2>
              <p>
                You own the data you put into Wingman. We&apos;re a processor of that data on your
                behalf, per our Privacy Policy.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">7. Limitation of liability</h2>
              <p>
                Wingman is provided &quot;as is.&quot; To the extent permitted by law, we are not
                liable for indirect or consequential damages arising from use of the service.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">8. Changes</h2>
              <p>
                We may update these terms from time to time. Material changes will be communicated
                to account owners by email.
              </p>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink mb-2">9. Contact</h2>
              <p>
                Questions about these terms: <span className="text-ink font-medium">legal@joinwingman.app</span>
              </p>
            </div>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
