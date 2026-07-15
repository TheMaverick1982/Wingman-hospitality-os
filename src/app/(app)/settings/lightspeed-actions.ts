"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { syncLightspeedOrg } from "@/lib/lightspeed-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

// Disconnect a single Lightspeed account. Removing our record is what matters;
// the token expires on its own.
export async function disconnectLightspeed(accountId: string): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  await admin.from("lightspeed_connections").delete().eq("org_id", profile.orgId).eq("account_id", accountId);
  revalidatePath("/settings");
  return { error: null };
}

export async function syncLightspeedNow(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncLightspeedOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
