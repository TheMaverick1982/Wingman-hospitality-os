"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyGroupBillingToOrg, setGroupBillingMode } from "@/lib/franchise-billing";

export type FranchiseActionState = { error: string | null; ok?: boolean };

async function requirePlatformAdmin() {
  const profile = await getCurrentProfile();
  return profile?.isPlatformAdmin ? profile : null;
}

export async function createFranchiseGroup(_prev: FranchiseActionState, formData: FormData): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  const name = String(formData.get("name") ?? "").trim();
  const billingMode = String(formData.get("billing_mode") ?? "distributed");
  if (!name) return { error: "Enter a group name." };
  const admin = createAdminClient();
  const { error } = await admin.from("franchise_groups").insert({ name, billing_mode: billingMode === "central" ? "central" : "distributed" });
  if (error) return { error: error.message };
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

// Delete a franchise group cleanly. Franchisee ACCOUNTS are never deleted — they
// are only detached: their billing flag is reset so they bill for themselves
// again, and any brand-standard content pushed to them is unlocked so they keep
// full control of their own copies. Then the group + its memberships/admins/
// brand links are removed. Platform-admin only.
export async function deleteFranchiseGroup(groupId: string): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId) return { error: "Missing group." };
  const admin = createAdminClient();

  // Detach every member org: no longer in a group, and bills for itself again.
  await admin.from("organizations").update({ franchise_group_id: null, billed_by_group: false }).eq("franchise_group_id", groupId);
  // Unlock any brand-standard content pushed from this group so franchisees keep
  // editable copies (the lock trigger would otherwise block them forever).
  await admin.from("tests").update({ brand_locked: false, brand_group_id: null }).eq("brand_group_id", groupId);

  // Remove the group's relationship rows, then the group itself.
  await admin.from("brand_content_links").delete().eq("group_id", groupId);
  await admin.from("franchise_memberships").delete().eq("group_id", groupId);
  await admin.from("franchise_admins").delete().eq("group_id", groupId);
  const { error } = await admin.from("franchise_groups").delete().eq("id", groupId);
  if (error) return { error: error.message };

  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function addFranchiseMember(groupId: string, orgId: string): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId || !orgId) return { error: "Pick an organization." };
  const admin = createAdminClient();
  // An org belongs to at most one group (unique on org_id) — upsert moves it.
  const { error } = await admin.from("franchise_memberships").upsert({ group_id: groupId, org_id: orgId, status: "active" }, { onConflict: "org_id" });
  if (error) return { error: error.message };
  await admin.from("organizations").update({ franchise_group_id: groupId }).eq("id", orgId);
  // Inherit the group's billing mode: central groups take over the member's charge.
  await applyGroupBillingToOrg(admin, groupId, orgId);
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function removeFranchiseMember(groupId: string, orgId: string): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("franchise_memberships").delete().eq("group_id", groupId).eq("org_id", orgId);
  // Leaving the group → the org bills for itself again.
  await admin.from("organizations").update({ franchise_group_id: null, billed_by_group: false }).eq("id", orgId);
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function changeGroupBillingMode(groupId: string, mode: "central" | "distributed"): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId) return { error: "Missing group." };
  await setGroupBillingMode(groupId, mode);
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function addFranchiseAdmin(groupId: string, userId: string, role: "admin" | "viewer"): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId || !userId) return { error: "Pick a person." };
  const admin = createAdminClient();
  const { error } = await admin.from("franchise_admins").upsert({ group_id: groupId, user_id: userId, role }, { onConflict: "group_id,user_id" });
  if (error) return { error: error.message };
  // The first full admin becomes the group's billing owner (their org holds the
  // group card for central billing). Only set it if not already claimed.
  if (role === "admin") {
    const { data: g } = await admin.from("franchise_groups").select("owner_user_id").eq("id", groupId).maybeSingle();
    if (!(g as { owner_user_id: string | null } | null)?.owner_user_id) {
      await admin.from("franchise_groups").update({ owner_user_id: userId }).eq("id", groupId);
    }
  }
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

// Provision a brand-new franchisor from scratch: create their login + a comp
// (free) "brand HQ" org, make them the group's billing owner + admin, and email
// a set-password invite. This is the path for a franchisor who has never bought
// a Wingman license (normal signup requires purchasing one).
export async function inviteFranchisor(groupId: string, formData: FormData): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId) return { error: "Missing group." };
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const brandName = String(formData.get("brand") ?? "").trim();
  // If the franchisor also runs corporate-owned locations, their HQ is a paying
  // account (bills per-location like a franchisee); otherwise it's comp.
  const runsCorporate = String(formData.get("corporate") ?? "") === "on";
  if (!name || !email) return { error: "Enter the franchisor's name and email." };

  const admin = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "https://www.joinwingman.app";
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?type=invite`,
  });
  if (inviteError) return { error: inviteError.message };

  // Create their comp HQ org (one placeholder location — the RPC requires ≥1;
  // a franchisor HQ has no store of its own). Runs as the platform admin.
  const supabase = await createClient();
  const orgName = brandName || `${name} — Franchisor HQ`;
  const { data: newOrgId, error: rpcError } = await supabase.rpc("create_organization_for_user", {
    org_name: orgName,
    owner_user_id: invited.user.id,
    gm_full_name: name,
    location_names: ["Headquarters"],
  });
  if (rpcError) return { error: rpcError.message };

  // Attach their new org to the group as the billing owner + grant admin oversight.
  await admin.from("franchise_admins").upsert({ group_id: groupId, user_id: invited.user.id, role: "admin" }, { onConflict: "group_id,user_id" });
  await admin.from("franchise_groups").update({ owner_user_id: invited.user.id }).eq("id", groupId);
  if (newOrgId) {
    const orgUpdate: Record<string, unknown> = { franchise_group_id: groupId };
    // Corporate operator → paying account so its own locations bill per-location
    // (separate from the franchisee roll-up). Pure franchisor stays comp.
    if (runsCorporate) {
      orgUpdate.is_free_account = false;
      orgUpdate.billing_status = "active";
    }
    await admin.from("organizations").update(orgUpdate).eq("id", newOrgId as string);
  }

  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function removeFranchiseAdmin(groupId: string, userId: string): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("franchise_admins").delete().eq("group_id", groupId).eq("user_id", userId);
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}
