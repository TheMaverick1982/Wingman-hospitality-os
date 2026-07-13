import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkOrCreateStaff } from "@/lib/staff-link";

export type LoginAccessRole = "manager" | "shift_lead" | "staff" | "super_admin";

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
  return { error: null };
}
