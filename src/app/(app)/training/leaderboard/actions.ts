"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

// Owner toggles the leaderboard on/off for the whole org.
export async function setLeaderboardEnabled(enabled: boolean): Promise<{ error: string | null }> {
  const p = await getCurrentProfile();
  if (!p || p.accessRole !== "super_admin") return { error: "Only the owner can change this." };
  const admin = createAdminClient();
  await admin.from("organizations").update({ leaderboard_enabled: enabled }).eq("id", p.orgId);
  revalidatePath("/training/leaderboard");
  revalidatePath("/training");
  return { error: null };
}
