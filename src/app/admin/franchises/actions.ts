"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function addFranchiseMember(groupId: string, orgId: string): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId || !orgId) return { error: "Pick an organization." };
  const admin = createAdminClient();
  // An org belongs to at most one group (unique on org_id) — upsert moves it.
  const { error } = await admin.from("franchise_memberships").upsert({ group_id: groupId, org_id: orgId, status: "active" }, { onConflict: "org_id" });
  if (error) return { error: error.message };
  await admin.from("organizations").update({ franchise_group_id: groupId }).eq("id", orgId);
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function removeFranchiseMember(groupId: string, orgId: string): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("franchise_memberships").delete().eq("group_id", groupId).eq("org_id", orgId);
  await admin.from("organizations").update({ franchise_group_id: null }).eq("id", orgId);
  revalidatePath("/admin/franchises");
  return { error: null, ok: true };
}

export async function addFranchiseAdmin(groupId: string, userId: string, role: "admin" | "viewer"): Promise<FranchiseActionState> {
  if (!(await requirePlatformAdmin())) return { error: "Not authorized." };
  if (!groupId || !userId) return { error: "Pick a person." };
  const admin = createAdminClient();
  const { error } = await admin.from("franchise_admins").upsert({ group_id: groupId, user_id: userId, role }, { onConflict: "group_id,user_id" });
  if (error) return { error: error.message };
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
