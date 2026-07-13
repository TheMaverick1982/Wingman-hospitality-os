"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export type PricingFormState = { error: string | null; ok?: boolean };

// Save the platform-wide plan pricing (whole dollars in the form → cents).
// Platform-admin only. One change here flows to every surface that reads
// getPlatformPricing().
export async function savePlatformPricing(_prev: PricingFormState, formData: FormData): Promise<PricingFormState> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return { error: "Not authorized." };

  const first = Math.round(Number(formData.get("first")) || 0);
  const addl = Math.round(Number(formData.get("addl")) || 0);
  if (first <= 0) return { error: "Enter a first-location price." };
  if (addl < 0) return { error: "Additional-location price can't be negative." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_pricing")
    .upsert({ id: true, first_location_cents: first * 100, addl_location_cents: addl * 100, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return { error: error.message };

  // Everywhere the price shows.
  for (const p of ["/admin/billing", "/pricing", "/calculator", "/help", "/admin/sales-training"]) revalidatePath(p);
  return { error: null, ok: true };
}
