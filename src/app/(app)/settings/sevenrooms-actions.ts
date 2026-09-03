"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sevenroomsConfigured, sevenroomsVenueName } from "@/lib/sevenrooms";
import { syncSevenroomsOrg } from "@/lib/sevenrooms-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

// Link a SevenRooms venue by its Venue ID. The operator gets this after enabling
// Wingman as a partner integration in SevenRooms. We validate the Venue ID by
// fetching the venue (which also gives us its name for per-location matching),
// then store the connection. No token is stored — data access uses our partner
// client credentials scoped to this venue.
export async function connectSevenrooms(venueIdRaw: string): Promise<{ error: string | null; name?: string }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  if (!sevenroomsConfigured()) return { error: "SevenRooms isn't set up yet — it's still in partner onboarding." };
  const venueId = venueIdRaw.trim();
  if (!venueId) return { error: "Enter your SevenRooms Venue ID." };

  let name = "";
  try {
    name = await sevenroomsVenueName(venueId);
  } catch (e) {
    return { error: `Couldn't reach that venue on SevenRooms — double-check the Venue ID. (${String(e).slice(0, 120)})` };
  }

  const admin = createAdminClient();
  await admin.from("sevenrooms_connections").upsert(
    {
      org_id: profile.orgId,
      venue_id: venueId,
      venue_name: name,
      connected_by: profile.userId,
      connected_at: new Date().toISOString(),
      last_sync_status: null,
    },
    { onConflict: "org_id,venue_id" },
  );

  // First pull right away so the owner sees data immediately.
  const res = await syncSevenroomsOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return { error: res.error, name: name || venueId };
}

export async function disconnectSevenrooms(venueId: string): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  await admin.from("sevenrooms_connections").delete().eq("org_id", profile.orgId).eq("venue_id", venueId);
  revalidatePath("/settings");
  return { error: null };
}

export async function syncSevenroomsNow(): Promise<{ error: string | null; guests: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0 };
  const res = await syncSevenroomsOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
