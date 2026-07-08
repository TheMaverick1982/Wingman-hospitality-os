"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { EDITABLE_SECTIONS, type PermissionOverrides, type Section } from "@/lib/auth/permissions";

export type ActionState = { error: string | null };
export type BatchState = { error: string | null; successCount: number; failures: { index: number; message: string }[] };

const MAX_BATCH_SIZE = 20;

export async function inviteTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { error: "Only a Super Admin can invite team members." };

  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const locationId = String(formData.get("locationId") || "");
  const role = String(formData.get("role") || "");

  if (!email || !fullName || !locationId) return { error: "Name, email, and location are required." };
  if (role !== "manager" && role !== "staff") return { error: "Invalid role." };

  const origin = (await headers()).get("origin");
  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?type=invite`,
  });
  if (inviteError) return { error: inviteError.message };

  const supabase = await createClient();
  const { error: assignError } = await supabase.rpc("assign_team_member_profile", {
    new_user_id: invited.user.id,
    full_name: fullName,
    target_location_id: locationId,
    target_role: role,
  });
  if (assignError) return { error: assignError.message };

  revalidatePath("/settings");
  return { error: null };
}

export async function bulkInviteTeamMembers(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can invite team members.", successCount: 0, failures: [] };
  }

  let rows: { fullName: string; email: string; role: string; locationId: string }[];
  try {
    rows = JSON.parse(String(formData.get("membersJson") || "[]"));
  } catch {
    return { error: "Invalid submission.", successCount: 0, failures: [] };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Add at least one team member.", successCount: 0, failures: [] };
  if (rows.length > MAX_BATCH_SIZE) return { error: `Invite up to ${MAX_BATCH_SIZE} team members at a time.`, successCount: 0, failures: [] };

  const origin = (await headers()).get("origin");
  const admin = createAdminClient();
  const supabase = await createClient();
  const failures: { index: number; message: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = (row.email || "").trim();
    const fullName = (row.fullName || "").trim();
    const locationId = row.locationId || "";
    const role = row.role === "staff" ? "staff" : "manager";

    if (!email || !fullName || !locationId) {
      failures.push({ index: i, message: "Name, email, and location are required." });
      continue;
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?type=invite`,
    });
    if (inviteError || !invited?.user) {
      failures.push({ index: i, message: inviteError?.message ?? "Invite failed." });
      continue;
    }

    const { error: assignError } = await supabase.rpc("assign_team_member_profile", {
      new_user_id: invited.user.id,
      full_name: fullName,
      target_location_id: locationId,
      target_role: role,
    });
    if (assignError) {
      failures.push({ index: i, message: assignError.message });
      continue;
    }
    successCount++;
  }

  revalidatePath("/settings");
  return { error: failures.length > 0 && successCount === 0 ? "Couldn't send any invites." : null, successCount, failures };
}

export async function updateTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { error: "Only a Super Admin can edit team members." };

  const userId = String(formData.get("userId") || "");
  const locationId = String(formData.get("locationId") || "");
  const role = String(formData.get("role") || "");
  if (!userId || !locationId || (role !== "manager" && role !== "staff")) return { error: "Invalid update." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ location_id: locationId, access_role: role })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}

export async function addLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { error: "Only the account owner can add locations." };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Location name is required." };
  const address = String(formData.get("address") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase.from("locations").insert({ org_id: org.id, name, address, phone, email });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}

export async function bulkAddLocations(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only the account owner can add locations.", successCount: 0, failures: [] };
  }

  let rows: { name: string; address: string; phone: string; email: string }[];
  try {
    rows = JSON.parse(String(formData.get("locationsJson") || "[]"));
  } catch {
    return { error: "Invalid submission.", successCount: 0, failures: [] };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Add at least one location.", successCount: 0, failures: [] };
  if (rows.length > MAX_BATCH_SIZE) return { error: `Add up to ${MAX_BATCH_SIZE} locations at a time.`, successCount: 0, failures: [] };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found.", successCount: 0, failures: [] };

  const failures: { index: number; message: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || "").trim();
    if (!name) {
      failures.push({ index: i, message: "Location name is required." });
      continue;
    }
    const { error } = await supabase.from("locations").insert({
      org_id: org.id,
      name,
      address: (row.address || "").trim(),
      phone: (row.phone || "").trim(),
      email: (row.email || "").trim(),
    });
    if (error) failures.push({ index: i, message: error.message });
    else successCount++;
  }

  revalidatePath("/settings");
  return { error: failures.length > 0 && successCount === 0 ? "Couldn't add any locations." : null, successCount, failures };
}

export async function updatePermissionOverrides(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { error: "Only the account owner can change permissions." };

  let overrides: PermissionOverrides;
  try {
    overrides = JSON.parse(String(formData.get("overridesJson") || "{}"));
  } catch {
    return { error: "Invalid submission." };
  }

  // Only allow known, editable sections and manager/staff roles through --
  // Settings and Super Admin are never overridable, regardless of payload.
  const clean: PermissionOverrides = {};
  for (const section of Object.keys(overrides) as Section[]) {
    if (!EDITABLE_SECTIONS.includes(section)) continue;
    const roles = overrides[section];
    if (!roles) continue;
    const cleanRoles: Partial<Record<"manager" | "staff", "full" | "view" | "none">> = {};
    for (const role of ["manager", "staff"] as const) {
      const value = roles[role];
      if (value === "full" || value === "view" || value === "none") cleanRoles[role] = value;
    }
    if (Object.keys(cleanRoles).length > 0) clean[section] = cleanRoles;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ permission_overrides: clean }).eq("id", profile.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { error: null };
}
