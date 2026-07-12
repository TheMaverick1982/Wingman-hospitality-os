"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { PLATFORM_ACCESS_OPTIONS } from "@/lib/auth/platform";
import { sendEmail } from "@/lib/email";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { uploadW9File, w9RequestEmailHtml } from "@/lib/w9";

const ORIGIN = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";

export type TeamState = { error: string | null };

const VALID = new Set(PLATFORM_ACCESS_OPTIONS.map((s) => s.key));

function cleanSections(raw: string[]): string[] {
  return [...new Set(raw.filter((s) => VALID.has(s as never)))];
}

// Email a staff member the W-9 to complete and mark it requested. Best-effort:
// the caller decides how to surface a failure.
async function sendW9Request(admin: SupabaseClient, userId: string, email: string, name: string): Promise<{ error: string | null }> {
  try {
    await sendEmail({
      to: [email],
      subject: "Please complete your W-9 for Wingman",
      html: w9RequestEmailHtml(name, BILLING_OWNER_EMAIL),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send the W-9 email." };
  }
  await admin
    .from("profiles")
    .update({ w9_status: "requested", w9_requested_at: new Date().toISOString() })
    .eq("id", userId);
  return { error: null };
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
    // Invite a brand-new person, then create their profile in the hidden
    // internal "Wingman Platform" org — NOT in any customer org. This keeps
    // platform staff isolated from customer data; the only way they reach a
    // customer's account is the explicit "Log in as client" permission.
    const { data: platformOrg } = await admin
      .from("organizations")
      .select("id")
      .eq("is_platform", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!platformOrg) {
      return { error: "The internal platform organization is missing — run migration 0037 in Supabase first." };
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?type=invite`,
    });
    if (inviteError) return { error: inviteError.message };
    userId = invited.user.id;

    // super_admin needs no location, which suits the empty internal org and
    // satisfies the profiles location constraint. The is_platform_admin flag and
    // section access are set in the shared update below.
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      org_id: platformOrg.id,
      full_name: fullName || email.split("@")[0],
      access_role: "super_admin",
      location_id: null,
      all_locations: false,
    });
    if (profileError) return { error: profileError.message };
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_platform_admin: true, platform_access: sections })
    .eq("id", userId);
  if (error) return { error: error.message };

  // Sales reps are paid contractors, so auto-send the W-9 when Sales Training
  // access is granted (our signal for "this is a sales rep"). Best-effort — a
  // failed email never blocks adding the teammate; the owner can resend later.
  if (sections.includes("sales_training")) {
    await sendW9Request(admin, userId, email, fullName);
  }

  revalidatePath("/admin/team");
  return { error: null };
}

// Manually (re)send the W-9 request to a staff member.
export async function requestW9(profileId: string): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Not authorized." };
  if (!profileId) return { error: "Missing teammate." };
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(profileId);
  const email = data?.user?.email;
  if (!email) return { error: "Couldn't find that teammate's email." };
  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  const name = (prof as { full_name: string } | null)?.full_name ?? "";
  const res = await sendW9Request(admin, profileId, email, name);
  if (res.error) return res;
  revalidatePath("/admin/team");
  return { error: null };
}

// Attach a returned W-9 to a staff member's profile and mark it received.
export async function uploadW9(profileId: string, formData: FormData): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Not authorized." };
  if (!profileId) return { error: "Missing teammate." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to upload." };

  const { path, error } = await uploadW9File(profileId, file);
  if (error || !path) return { error: error ?? "Upload failed." };

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ w9_status: "received", w9_received_at: new Date().toISOString(), w9_file_path: path })
    .eq("id", profileId);
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

// Resend the account-setup (invite) email to a teammate who hasn't accepted
// yet. Routed through Supabase so it uses the project's branded invite template
// and configured sender — the same path as a normal team invite.
export async function resendPlatformInvite(email: string): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Not authorized." };
  const clean = email.trim();
  if (!clean) return { error: "Missing email." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(clean, {
    redirectTo: `${ORIGIN()}/auth/callback?type=invite`,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// Send a password-reset email to a teammate — same flow as the login page's
// "Forgot password" (recovery link → /auth/callback → /set-password). Useful
// once they've accepted and just need a new password.
export async function sendPlatformPasswordReset(email: string): Promise<TeamState> {
  const me = await platformSectionActor("team");
  if (!me) return { error: "Not authorized." };
  const clean = email.trim();
  if (!clean) return { error: "Missing email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: `${ORIGIN()}/auth/callback?type=recovery`,
  });
  if (error) return { error: error.message };
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
