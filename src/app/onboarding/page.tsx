import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isNativeIOS } from "@/lib/native/platform";
import { captureReferralForCurrentUser } from "@/lib/affiliate";
import { markCustomerByEmail } from "@/lib/crm-sequences";
import { redeemCouponForOrg } from "@/lib/coupons";
import OnboardingForm from "./form";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const existingProfile = await getCurrentProfile();
  if (existingProfile) redirect("/dashboard");

  // App Review compliance (guideline 3.1.1): the native iOS app must not create
  // business/organization accounts. Existing users land on /dashboard above;
  // anyone else reaching onboarding inside the app is sent to login.
  if (await isNativeIOS()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Defense in depth: getCurrentProfile() returned null above, but this user may
  // in fact already have an organization — that means the profile read is failing
  // transiently, NOT that they're a new user. We must NEVER auto-redirect back to
  // /dashboard here: /dashboard bounces to /onboarding when getCurrentProfile is
  // null, so a redirect from this page would create an infinite loop
  // (ERR_TOO_MANY_REDIRECTS). Instead show a calm "reload" recovery screen — a
  // manual reload lets the transient condition clear without ever looping. (The
  // create_organization RPC also hard-refuses a second org, so no data is at risk
  // either way; this just keeps a set-up owner off the create-org form.)
  {
    const admin = createAdminClient();
    const { data: existingRow } = await admin.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
    if ((existingRow as { org_id?: string } | null)?.org_id) {
      return (
        <div className="mx-auto max-w-sm py-16 text-center">
          <h1 className="font-display text-2xl font-semibold mb-2 text-ink">Just a moment…</h1>
          <p className="text-sm text-muted mb-6">
            We&rsquo;re having trouble loading your account right now. Your data is safe — this usually clears in a few
            seconds. Reload to try again.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-brick px-5 py-2.5 text-sm font-semibold text-white hover:bg-brick-dark transition-colors"
          >
            Reload
          </a>
        </div>
      );
    }
  }

  const pendingOrgName = user.user_metadata?.pending_org_name as string | undefined;
  const pendingLocationName = user.user_metadata?.pending_location_name as string | undefined;
  const pendingFullName = user.user_metadata?.pending_full_name as string | undefined;
  const pendingCouponCode = user.user_metadata?.pending_coupon_code as string | undefined;

  if (pendingOrgName && pendingLocationName && pendingFullName) {
    const { error } = await supabase.rpc("create_organization", {
      org_name: pendingOrgName,
      gm_full_name: pendingFullName,
      first_location_name: pendingLocationName,
    });
    if (!error) {
      await captureReferralForCurrentUser(supabase);
      if (user.email) {
        const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
        const orgId = (prof as { org_id: string } | null)?.org_id;
        if (pendingCouponCode && orgId) await redeemCouponForOrg(pendingCouponCode, orgId, "signup");
        await markCustomerByEmail(user.email, { orgId, workspaceName: pendingOrgName, name: pendingFullName });
      }
      redirect("/dashboard");
    }
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-display text-2xl font-semibold mb-1 text-ink">Finish setting up</h1>
      <p className="text-sm text-muted mb-6">
        Your account is confirmed — just need a few details to create your organization.
      </p>
      <OnboardingForm />
    </div>
  );
}
