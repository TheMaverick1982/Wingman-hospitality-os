"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { getCurrentProfile } from "@/lib/auth/profile";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
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

// Restore a soft-deleted lead. Owner-only (brian@brianhardy.com) — the Deleted
// Leads view and restore are reserved for the account owner.
export async function restoreLead(id: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin || profile.email !== BILLING_OWNER_EMAIL) return { ok: false, error: "Owner only." };
  if (!id) return { ok: false, error: "Missing lead id." };
  const admin = createAdminClient();
  const { error } = await admin.from("leads").update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/leads/deleted");
  revalidatePath("/admin/leads");
  return { ok: true };
}
