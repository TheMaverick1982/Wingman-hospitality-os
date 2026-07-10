"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { captureReferralForCurrentUser } from "@/lib/affiliate";

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

  await captureReferralForCurrentUser(supabase);
  redirect("/start-here");
}
