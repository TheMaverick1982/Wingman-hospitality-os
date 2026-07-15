"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { revokeToken } from "@/lib/square";
import { syncSquareOrg } from "@/lib/square-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

export async function disconnectSquare(): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  const { data: conn } = await admin.from("square_connections").select("access_token").eq("org_id", profile.orgId).maybeSingle();
  if (conn?.access_token) await revokeToken((conn as { access_token: string }).access_token);
  await admin.from("square_connections").delete().eq("org_id", profile.orgId);
  revalidatePath("/settings");
  return { error: null };
}

export async function syncSquareNow(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncSquareOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
