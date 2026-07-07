"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";

export type AnalyticsSettingsState = { error: string | null; success: boolean };

export async function updateGaMeasurementId(
  _prev: AnalyticsSettingsState,
  formData: FormData
): Promise<AnalyticsSettingsState> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) {
    return { error: "Not authorized.", success: false };
  }

  const gaMeasurementId = String(formData.get("gaMeasurementId") || "").trim();

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .update({ ga_measurement_id: gaMeasurementId || null, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateTag("ga-measurement-id", "max");
  revalidatePath("/admin/analytics");
  return { error: null, success: true };
}
