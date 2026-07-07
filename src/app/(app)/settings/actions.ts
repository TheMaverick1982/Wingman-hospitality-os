"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";

export type ActionState = { error: string | null };

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
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Location name is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase.from("locations").insert({ org_id: org.id, name });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}
