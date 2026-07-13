"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import { NOTIFICATION_TYPES, type NotificationKey } from "@/lib/notifications";

const VALID = new Set<string>(NOTIFICATION_TYPES.map((n) => n.key));

// Save the account's notification on/off choices. Managers and owners can edit;
// scoped to the caller's own org. Only known keys are accepted.
export async function updateNotificationSettings(
  patch: Record<string, boolean>
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're not signed in." };
  if (!isManagerOrAbove(profile.accessRole)) return { error: "You don't have access to notification settings." };

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("notification_settings").eq("id", profile.orgId).maybeSingle();
  const current = ((org?.notification_settings as Record<string, boolean> | null) ?? {}) as Partial<Record<NotificationKey, boolean>>;

  const next: Partial<Record<NotificationKey, boolean>> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (VALID.has(k)) next[k as NotificationKey] = Boolean(v);
  }

  const { error } = await admin.from("organizations").update({ notification_settings: next }).eq("id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
