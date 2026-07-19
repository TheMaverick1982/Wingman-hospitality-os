"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";

// Soft-delete a marketing lead. Stamps deleted_at so the capture is hidden from
// the Leads table but never destroyed (recoverable at the data layer). Platform
// leads are org-less, so this sits outside the per-org Trash by design.
export async function deleteLead(id: string): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformSection("analytics");
  if (!id) return { ok: false, error: "Missing lead id." };
  const admin = createAdminClient();
  const { error } = await admin.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/leads");
  return { ok: true };
}
