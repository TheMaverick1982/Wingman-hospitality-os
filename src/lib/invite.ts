import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkOrCreateStaff } from "@/lib/staff-link";
import { sendEmail } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LoginAccessRole = "manager" | "shift_lead" | "staff" | "super_admin" | "developer";

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

// A short, branded welcome for an invited team member. Supabase's invite email
// carries the set-password link (the "accept invite" action); this is the warm
// hello + get-the-app nudge, since a staffer/manager joining an already-set-up
// workspace doesn't get the owner's "set up your system" onboarding. Best-effort
// — never blocks or fails the invite.
async function sendTeamWelcome(admin: SupabaseClient, args: { orgId: string; email: string; fullName: string }): Promise<void> {
  try {
    const { data: org } = await admin.from("organizations").select("name").eq("id", args.orgId).maybeSingle();
    const orgName = ((org as { name?: string } | null)?.name || "your team").trim();
    const firstName = (args.fullName || "").trim().split(/\s+/)[0] || "there";

    await sendEmail({
      to: [args.email],
      subject: `Welcome to Wingman — ${orgName}`,
      html: `<p>Hi ${firstName},</p>
<p>You've been added to <strong>${orgName}</strong> on Wingman — the app your team uses for training, your role's standards, shift checklists, and more. Welcome aboard!</p>
<p><strong>Two quick steps to get going:</strong></p>
<ol>
<li><strong>Set your password.</strong> Look for a separate email from us (subject: &ldquo;You have been invited&rdquo;) and click the link to create your password.</li>
<li><strong>Get the app.</strong> Download Wingman on your phone — it's where you'll use it every shift: <a href="${APP_URL}/download">${APP_URL.replace(/^https?:\/\//, "")}/download</a> (App Store &amp; Google Play). Log in with this email and the password you just set.</li>
</ol>
<p>Once you're in, open <strong>Your role</strong> to see exactly what's expected of you, and tap <strong>Ask Wingman</strong> anytime you have a question — it answers from your restaurant's own standards, menu, and playbook.</p>
<p>See you on the floor.</p>`,
    });
  } catch {
    /* welcome email is best-effort; the invite itself already succeeded */
  }
}

// Send a "set up your account" login invite and tie it to the person's Staff
// record. The caller must be a Super Admin — assign_team_member_profile is a
// SECURITY DEFINER RPC that enforces that on the caller's session. Returns an
// error string on failure (e.g. the email already has an account).
export async function sendLoginInvite(args: {
  orgId: string;
  email: string;
  fullName: string;
  accessRole: LoginAccessRole;
  department: string;
  locationId: string;
}): Promise<{ error: string | null }> {
  const email = args.email.trim();
  if (!email) return { error: "An email is required to send a login invite." };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?type=invite`,
  });
  if (inviteError || !invited?.user) {
    return { error: inviteError?.message ?? "Couldn't send the invite." };
  }

  const isAdmin = args.accessRole === "super_admin";
  const supabase = await createClient();
  const { error: assignError } = await supabase.rpc("assign_team_member_profile", {
    new_user_id: invited.user.id,
    full_name: args.fullName,
    target_role: args.accessRole,
    target_location_id: isAdmin ? null : args.locationId,
    target_all_locations: isAdmin,
    target_location_ids: isAdmin ? [] : [args.locationId],
  });
  if (assignError) return { error: assignError.message };

  await linkOrCreateStaff(admin, args.orgId, {
    email,
    fullName: args.fullName,
    department: args.department,
    locationId: args.locationId,
    profileId: invited.user.id,
  });

  // Warm welcome + get-the-app nudge (in addition to Supabase's set-password
  // invite). Best-effort — a failure here never fails the invite.
  await sendTeamWelcome(admin, { orgId: args.orgId, email, fullName: args.fullName });

  return { error: null };
}
