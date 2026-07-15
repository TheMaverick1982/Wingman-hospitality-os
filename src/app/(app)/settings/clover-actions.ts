"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { syncCloverOrg } from "@/lib/clover-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

// Disconnect a single Clover store (merchant). Removing our record is what
// matters; Clover tokens expire on their own.
export async function disconnectClover(merchantId: string): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  await admin.from("clover_connections").delete().eq("org_id", profile.orgId).eq("merchant_id", merchantId);
  revalidatePath("/settings");
  return { error: null };
}

// Finish an App-Market install: attach a pending Clover store (stashed at launch)
// to the now-signed-in owner's org. Cookie-driven so it works on whatever page
// the merchant lands after logging in / signing up. Silently no-ops if there's
// no pending cookie, or if the signed-in user isn't the account owner.
export async function finalizeCloverInstall(): Promise<{ ok: boolean; merchantName?: string; needsOwner?: boolean }> {
  const jar = await cookies();
  const nonce = jar.get("clover_pending")?.value;
  if (!nonce) return { ok: false };

  const profile = await getCurrentProfile();
  if (!profile) return { ok: false };
  if (profile.accessRole !== "super_admin") return { ok: false, needsOwner: true };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("clover_pending_installs")
    .select("merchant_id, merchant_name, access_token, refresh_token, token_expires_at, refresh_expires_at")
    .eq("id", nonce)
    .maybeSingle();
  const pending = row as
    | { merchant_id: string; merchant_name: string; access_token: string; refresh_token: string; token_expires_at: string | null; refresh_expires_at: string | null }
    | null;

  // Clear the cookie regardless — it's single-use.
  jar.delete("clover_pending");
  if (!pending) return { ok: false };

  await admin.from("clover_connections").upsert(
    {
      org_id: profile.orgId,
      merchant_id: pending.merchant_id,
      merchant_name: pending.merchant_name,
      access_token: pending.access_token,
      refresh_token: pending.refresh_token,
      token_expires_at: pending.token_expires_at,
      refresh_expires_at: pending.refresh_expires_at,
      scopes: "",
      connected_by: profile.userId,
      connected_at: new Date().toISOString(),
      last_sync_status: null,
    },
    { onConflict: "org_id,merchant_id" },
  );
  await admin.from("clover_pending_installs").delete().eq("id", nonce);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, merchantName: pending.merchant_name };
}

export async function syncCloverNow(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncCloverOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
