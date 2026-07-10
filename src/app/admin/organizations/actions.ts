"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { getOrgOwnerEmails } from "@/lib/billing";
import { sendEmail } from "@/lib/email";

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

export type BillingAdminState = { error: string | null; ok: boolean };

// Email the org's owners a link to set up paid billing (add a card). The setup
// page hosts the payment fields; the actual card capture arrives with the
// payment processor. Platform-admin only.
export async function sendBillingSetupEmail(orgId: string): Promise<BillingAdminState> {
  const me = await platformSectionActor("organizations");
  if (!me) return { error: "Not authorized.", ok: false };

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = (org as { name: string } | null)?.name ?? "your organization";
  const emails = await getOrgOwnerEmails(admin, orgId);
  if (emails.length === 0) return { error: "This organization has no owner email on file.", ok: false };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";
  const link = `${origin}/billing/setup`;
  try {
    await sendEmail({
      to: emails,
      subject: "Set up billing for your Wingman account",
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;">
        <p style="font-size:16px;">It's time to set up billing for <strong>${orgName.replace(/[<>&]/g, "")}</strong>.</p>
        <p style="font-size:15px;color:#525252;">Add your payment method to keep your account active:</p>
        <p style="font-size:15px;"><a href="${link}" style="color:#0a6cff;font-weight:600;">${link}</a></p>
        <p style="font-size:13px;color:#767676;">You may be asked to log in first.</p>
      </div>`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't send the email.", ok: false };
  }
  return { error: null, ok: true };
}

// Manually flip an org between Free and Paid (comps, or when a card is collected
// another way). Writes with the service-role client, which bypasses the billing
// guard trigger.
export async function setOrgBillingMode(orgId: string, paid: boolean): Promise<BillingAdminState> {
  const me = await platformSectionActor("organizations");
  if (!me) return { error: "Not authorized.", ok: false };
  if (!orgId) return { error: "Missing organization.", ok: false };

  const admin = createAdminClient();
  const update = paid
    ? { is_free_account: false, billing_status: "active" }
    : { is_free_account: true, billing_status: "free" };
  const { error } = await admin.from("organizations").update(update).eq("id", orgId);
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/admin/organizations/${orgId}`);
  return { error: null, ok: true };
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
