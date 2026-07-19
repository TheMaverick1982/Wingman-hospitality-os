"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";

// Deleting and restoring leads is reserved for the account owner
// (brian@brianhardy.com) — the checkboxes/Delete and the Deleted Leads view
// only appear in the owner's view.
async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin || profile.email !== BILLING_OWNER_EMAIL) return null;
  return profile;
}

// Soft-delete one or more marketing leads. Stamps deleted_at so the captures are
// hidden from the Leads table but never destroyed (recoverable from the Deleted
// Leads view). Platform leads are org-less, so this sits outside the per-org Trash.
export async function deleteLeads(ids: string[]): Promise<{ ok: boolean; deleted: number; error?: string }> {
  if (!(await requireOwner())) return { ok: false, deleted: 0, error: "Owner only." };
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return { ok: true, deleted: 0 };
  const admin = createAdminClient();
  const { error } = await admin.from("leads").update({ deleted_at: new Date().toISOString() }).in("id", clean);
  if (error) return { ok: false, deleted: 0, error: error.message };
  revalidatePath("/admin/leads");
  return { ok: true, deleted: clean.length };
}

// Restore a soft-deleted lead. Owner-only.
export async function restoreLead(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireOwner())) return { ok: false, error: "Owner only." };
  if (!id) return { ok: false, error: "Missing lead id." };
  const admin = createAdminClient();
  const { error } = await admin.from("leads").update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/leads/deleted");
  revalidatePath("/admin/leads");
  return { ok: true };
}
