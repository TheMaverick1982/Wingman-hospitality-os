"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

// Add a teammate as platform staff with the chosen section access. If they
// don't have a Wingman account yet, invite them into the adding admin's org (as
// Staff) so they get a login, then grant platform access — all in one step.
export async function addPlatformStaff(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Only a platform admin with Team access can add staff." };

  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const sections = cleanSections(formData.getAll("sections").map(String));
  if (!email) return { error: "Enter the teammate's email." };
  if (sections.length === 0) return { error: "Choose at least one section they can access." };

  const admin = createAdminClient();
  let userId = await findUserIdByEmail(admin, email);

  if (!userId) {
    // Invite a brand-new person, then create their profile in the adding
    // admin's org (Staff) via the same path as a normal team invite.
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?type=invite`,
    });
    if (inviteError) return { error: inviteError.message };
    userId = invited.user.id;

    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("assign_team_member_profile", {
      new_user_id: userId,
      full_name: fullName || email.split("@")[0],
      target_role: "staff",
      target_location_id: null,
      target_all_locations: true,
      target_location_ids: [],
    });
    if (rpcError) {
      return {
        error: `Couldn't set up their account (${rpcError.message}). You need to be a Super Admin of your own organization to invite brand-new staff — otherwise have them sign up first, then add them here.`,
      };
    }
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
