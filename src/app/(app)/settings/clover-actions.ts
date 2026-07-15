"use server";

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

export async function syncCloverNow(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncCloverOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
