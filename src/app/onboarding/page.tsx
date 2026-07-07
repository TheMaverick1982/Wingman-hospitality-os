import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import OnboardingForm from "./form";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const existingProfile = await getCurrentProfile();
  if (existingProfile) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pendingOrgName = user.user_metadata?.pending_org_name as string | undefined;
  const pendingLocationName = user.user_metadata?.pending_location_name as string | undefined;
  const pendingFullName = user.user_metadata?.pending_full_name as string | undefined;

  if (pendingOrgName && pendingLocationName && pendingFullName) {
    const { error } = await supabase.rpc("create_organization", {
      org_name: pendingOrgName,
      gm_full_name: pendingFullName,
      first_location_name: pendingLocationName,
    });
    if (!error) redirect("/dashboard");
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
