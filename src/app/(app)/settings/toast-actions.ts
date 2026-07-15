"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { toastConfigured, toastRestaurantName } from "@/lib/toast";
import { syncToastOrg } from "@/lib/toast-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

// Link a Toast restaurant by its Restaurant GUID. The owner gets this GUID after
// enabling Wingman in their Toast account (Toast → Integrations). We validate the
// GUID by fetching the restaurant's config (which also gives us its name for
// per-location matching), then store the connection. Tokens are never stored —
// data access uses our partner client credentials scoped to this GUID.
export async function connectToast(guidRaw: string): Promise<{ error: string | null; name?: string }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  if (!toastConfigured()) return { error: "Toast isn't set up yet — it's still in partner onboarding." };
  const guid = guidRaw.trim();
  if (!guid) return { error: "Enter your Toast Restaurant GUID." };

  let name = "";
  try {
    name = await toastRestaurantName(guid);
  } catch (e) {
    return { error: `Couldn't reach that restaurant on Toast — double-check the GUID. (${String(e).slice(0, 120)})` };
  }

  const admin = createAdminClient();
  await admin.from("toast_connections").upsert(
    {
      org_id: profile.orgId,
      restaurant_guid: guid,
      restaurant_name: name,
      connected_by: profile.userId,
      connected_at: new Date().toISOString(),
      last_sync_status: null,
    },
    { onConflict: "org_id,restaurant_guid" },
  );

  // First pull right away so the owner sees data immediately.
  const res = await syncToastOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return { error: res.error, name: name || guid };
}

// Disconnect a single Toast restaurant. Removing our record is all that's needed.
export async function disconnectToast(restaurantGuid: string): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  await admin.from("toast_connections").delete().eq("org_id", profile.orgId).eq("restaurant_guid", restaurantGuid);
  revalidatePath("/settings");
  return { error: null };
}

export async function syncToastNow(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncToastOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
