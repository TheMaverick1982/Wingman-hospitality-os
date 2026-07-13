"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

// Manually attribute an org to an affiliate (or clear it) — for cases where the
// affiliate made the intro but the customer was signed up by hand. Platform
// "organizations" access only.
export async function setOrgAffiliate(orgId: string, affiliateId: string | null): Promise<{ error: string | null }> {
  const me = await getCurrentProfile();
  if (!me?.isPlatformAdmin || !me.platformAccess.includes("organizations")) return { error: "Not authorized." };

  const admin = createAdminClient();
  if (affiliateId) {
    const { data: aff } = await admin.from("affiliates").select("id, status").eq("id", affiliateId).maybeSingle();
    if (!aff) return { error: "Affiliate not found." };
    if ((aff as { status: string }).status !== "approved") return { error: "That affiliate isn't approved." };
  }
  const { error } = await admin.from("organizations").update({ referred_by_affiliate_id: affiliateId }).eq("id", orgId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/organizations/${orgId}`);
  return { error: null };
}
