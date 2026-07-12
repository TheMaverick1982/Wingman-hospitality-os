"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { captureReferralForCurrentUser } from "@/lib/affiliate";
import { markCustomerByEmail } from "@/lib/crm-sequences";
import { redeemCouponForOrg } from "@/lib/coupons";

export type OnboardingState = { error: string | null };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const orgName = String(formData.get("orgName") || "").trim();
  const locationName = String(formData.get("locationName") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();

  if (!orgName || !locationName || !fullName) {
    return { error: "All fields are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    org_name: orgName,
    gm_full_name: fullName,
    first_location_name: locationName,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: { user } } = await supabase.auth.getUser();
  await captureReferralForCurrentUser(supabase);
  if (user?.email) {
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
    const orgId = (prof as { org_id: string } | null)?.org_id;
    const pendingCoupon = user.user_metadata?.pending_coupon_code as string | undefined;
    if (pendingCoupon && orgId) await redeemCouponForOrg(pendingCoupon, orgId, "signup");
    await markCustomerByEmail(user.email, { orgId, workspaceName: orgName, name: fullName });
  }
  redirect("/start-here");
}
