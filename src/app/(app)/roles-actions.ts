"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { activateDepartment, deactivateDepartment } from "@/lib/roles";

export type RoleActionState = { error: string | null; ok?: boolean };

// Adding/removing a role touches both Training and Hiring, so we gate on being
// able to edit either one (an owner always can). Both pages revalidate.
async function authorize() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, denied: "Not signed in." as string | null };
  const canManage =
    canEditSection(profile.accessRole, "training", profile.permissionOverrides) ||
    canEditSection(profile.accessRole, "hiring", profile.permissionOverrides);
  return { profile, denied: canManage ? null : "You don't have access to manage roles." };
}

export async function addRole(department: string): Promise<RoleActionState> {
  const { profile, denied } = await authorize();
  if (denied || !profile) return { error: denied ?? "Not allowed." };

  const dept = department as Department;
  if (!ALL_DEPARTMENTS.includes(dept)) return { error: "Pick a valid role." };

  const supabase = await createClient();
  await activateDepartment(supabase, profile.orgId, dept);

  revalidatePath("/training");
  revalidatePath("/hiring");
  return { error: null, ok: true };
}

export async function removeRole(department: string): Promise<RoleActionState> {
  const { profile, denied } = await authorize();
  if (denied || !profile) return { error: denied ?? "Not allowed." };

  const dept = department as Department;
  if (!ALL_DEPARTMENTS.includes(dept)) return { error: "Pick a valid role." };

  const supabase = await createClient();
  await deactivateDepartment(supabase, profile.orgId, dept);

  revalidatePath("/training");
  revalidatePath("/hiring");
  return { error: null, ok: true };
}
