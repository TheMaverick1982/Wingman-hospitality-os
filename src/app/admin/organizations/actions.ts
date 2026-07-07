"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";

const IMPERSONATOR_COOKIE = "wingman_impersonator_refresh";

export async function impersonateUser(targetProfileId: string) {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) {
    throw new Error("Not authorized.");
  }

  const admin = createAdminClient();

  const { data: targetProfile, error: profileError } = await admin
    .from("profiles")
    .select("id, org_id")
    .eq("id", targetProfileId)
    .single();
  if (profileError || !targetProfile) {
    throw new Error("Target user not found.");
  }

  const { data: targetUser, error: userError } = await admin.auth.admin.getUserById(targetProfileId);
  if (userError || !targetUser.user?.email) {
    throw new Error("Target user has no login email.");
  }

  const supabase = await createClient();
  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.user.email,
  });
  if (linkError || !linkData) {
    throw new Error("Failed to generate impersonation session.");
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    throw new Error("Failed to start impersonation session.");
  }

  const cookieStore = await cookies();
  if (adminSession?.refresh_token) {
    cookieStore.set(IMPERSONATOR_COOKIE, adminSession.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  }

  await admin.from("impersonation_log").insert({
    platform_admin_id: profile.userId,
    target_profile_id: targetProfile.id,
    target_org_id: targetProfile.org_id,
  });

  redirect("/dashboard");
}

export async function exitImpersonation() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(IMPERSONATOR_COOKIE)?.value;
  cookieStore.delete(IMPERSONATOR_COOKIE);

  if (!refreshToken) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) {
    redirect("/dashboard");
  }

  redirect("/admin/organizations");
}
