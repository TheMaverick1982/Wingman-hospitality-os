"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteFranchiseeState = { error: string | null; ok?: boolean; name?: string };

// A FRANCHISOR admin invites a new franchisee into their own group (self-service).
// The franchisee gets a set-password email, a full standalone account seeded with
// the starter content, and is auto-attached to the group with the group's billing
// mode. Runs as the franchisor so the RPC's franchise-admin check authorizes it.
export async function inviteFranchisee(_prev: InviteFranchiseeState, formData: FormData): Promise<InviteFranchiseeState> {
  const profile = await getCurrentProfile();
  if (!profile?.franchiseGroupId || profile.franchiseRole !== "admin") {
    return { error: "Only a franchisor admin can add franchisees." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const businessName = String(formData.get("business") ?? "").trim();
  const locationName = String(formData.get("location") ?? "").trim();
  if (!name || !email) return { error: "Enter the franchisee owner's name and email." };
  const orgName = businessName || `${name}'s location`;

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "https://www.joinwingman.app";
  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?type=invite`,
  });
  if (inviteError) return { error: inviteError.message };

  // Create the franchisee org as the franchisor (RLS/auth context → the RPC's
  // franchise-admin check passes and the org auto-joins this group).
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("create_franchisee_for_group", {
    group_id: profile.franchiseGroupId,
    org_name: orgName,
    owner_user_id: invited.user.id,
    gm_full_name: name,
    location_names: [locationName || orgName],
  });
  if (rpcError) return { error: rpcError.message };

  revalidatePath("/franchise");
  return { error: null, ok: true, name: orgName };
}
