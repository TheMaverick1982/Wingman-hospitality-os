"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSectionActor } from "@/lib/auth/require-platform";

const IMPERSONATOR_COOKIE = "wingman_impersonator_refresh";

export type CreateOrgState = { error: string | null };
export type PricingState = { error: string | null; ok: boolean };

// Dollars string -> integer cents, or null if blank. Returns undefined on bad input.
function dollarsToCents(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

// Set (or clear) an organization's custom enterprise pricing. Platform-admin
// only; writes with the service-role client, which bypasses the pricing guard
// trigger. Flat monthly price takes precedence over a per-location rate.
export async function updateOrgPricing(orgId: string, formData: FormData): Promise<PricingState> {
  const me = await platformSectionActor("organizations");
  if (!me) return { error: "Not authorized.", ok: false };
  if (!orgId) return { error: "Missing organization.", ok: false };

  const monthly = dollarsToCents(String(formData.get("monthly") || ""));
  const addl = dollarsToCents(String(formData.get("addl") || ""));
  const note = String(formData.get("note") || "").trim();
  if (monthly === undefined) return { error: "Flat monthly price must be a positive number.", ok: false };
  if (addl === undefined) return { error: "Per-location price must be a positive number.", ok: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ custom_monthly_cents: monthly, custom_addl_location_cents: addl, pricing_note: note || null })
    .eq("id", orgId);
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/admin/organizations/${orgId}`);
  return { error: null, ok: true };
}

export async function createFreeOrganization(_prev: CreateOrgState, formData: FormData): Promise<CreateOrgState> {
  const profile = await platformSectionActor("organizations");
  if (!profile) return { error: "Only a platform admin with Organizations access can do this." };

  const orgName = String(formData.get("orgName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const ownerEmail = String(formData.get("ownerEmail") || "").trim();
  let locationNames: string[];
  try {
    locationNames = JSON.parse(String(formData.get("locationNamesJson") || "[]"));
  } catch {
    return { error: "Couldn't read the submitted locations." };
  }
  const cleanLocations = locationNames.map((l) => l.trim()).filter(Boolean);

  if (!orgName || !ownerName || !ownerEmail) {
    return { error: "Organization name, owner name, and owner email are required." };
  }
  if (cleanLocations.length === 0) return { error: "At least one location is required." };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
    redirectTo: `${origin}/auth/callback?type=invite`,
  });
  if (inviteError) return { error: inviteError.message };

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("create_organization_for_user", {
    org_name: orgName,
    owner_user_id: invited.user.id,
    gm_full_name: ownerName,
    location_names: cleanLocations,
  });
  if (rpcError) return { error: rpcError.message };

  revalidatePath("/admin/organizations");
  return { error: null };
}

export async function impersonateUser(targetProfileId: string) {
  const profile = await platformSectionActor("client_login");
  if (!profile) {
    throw new Error("You don't have “Log in as client” access.");
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
