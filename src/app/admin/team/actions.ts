"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";

export type TeamState = { error: string | null };

const VALID = new Set(PLATFORM_SECTIONS.map((s) => s.key));

function cleanSections(raw: string[]): string[] {
  return [...new Set(raw.filter((s) => VALID.has(s as never)))];
}

// Page through auth users to find one by email. Platform staff are few, so this
// is fine; capped so it can never run away.
async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 15; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (error || users.length === 0) break;
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (users.length < 200) break;
  }
  return null;
}

// Add a teammate as platform staff (by email) with the chosen section access.
export async function addPlatformStaff(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Only a platform admin with Team access can add staff." };

  const email = String(formData.get("email") || "").trim();
  const sections = cleanSections(formData.getAll("sections").map(String));
  if (!email) return { error: "Enter the teammate's email." };
  if (sections.length === 0) return { error: "Choose at least one section they can access." };

  const admin = createAdminClient();
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    return { error: "No Wingman account with that email. They need to sign up (or be invited to an organization) first, then add them here." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_platform_admin: true, platform_access: sections })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { error: null };
}

export async function updatePlatformStaffAccess(profileId: string, sections: string[]): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Not authorized." };
  if (!profileId) return { error: "Missing teammate." };

  const clean = cleanSections(sections);
  if (clean.length === 0) return { error: "Choose at least one section, or remove them instead." };

  // Don't let the last person who can manage the team lose Team access.
  if (!clean.includes("team")) {
    const guard = await wouldOrphanTeam(profileId);
    if (guard) return guard;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ platform_access: clean }).eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { error: null };
}

export async function removePlatformStaff(profileId: string): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Not authorized." };
  if (!profileId) return { error: "Missing teammate." };
  if (profileId === me.userId) return { error: "You can't remove your own platform access." };

  const guard = await wouldOrphanTeam(profileId);
  if (guard) return guard;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_platform_admin: false, platform_access: [] })
    .eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  return { error: null };
}

// Returns an error if removing this person's Team access would leave nobody able
// to manage platform staff.
async function wouldOrphanTeam(profileId: string): Promise<TeamState | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("is_platform_admin", true)
    .contains("platform_access", ["team"]);
  const teamAdmins = (data ?? []).map((r) => (r as { id: string }).id);
  if (teamAdmins.length <= 1 && teamAdmins.includes(profileId)) {
    return { error: "This is the last teammate who can manage the team — give someone else Team access first." };
  }
  return null;
}
