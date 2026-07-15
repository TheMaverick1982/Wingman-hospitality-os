"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { logAudit, type AuditEntity } from "@/lib/audit-log";

const TABLE: Record<AuditEntity, { table: string; label: string; path: string }> = {
  guest: { table: "guests", label: "name", path: "/bounceback" },
  partner: { table: "partner_contacts", label: "company_name", path: "/partners" },
  staff: { table: "staff_members", label: "name", path: "/staff" },
};

// Owner-only. Read/write via the service-role client since deleted rows are
// hidden from the RLS client. Every action is scoped to the owner's org and
// recorded to the audit log.
async function ownerAndAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return { profile, admin: createAdminClient() };
}

export async function restoreItem(entity: AuditEntity, id: string): Promise<{ error: string | null }> {
  const ctx = await ownerAndAdmin();
  if (!ctx) return { error: "Only the account owner can restore items." };
  const t = TABLE[entity];
  const { data: rowData } = await ctx.admin.from(t.table).select("*").eq("id", id).maybeSingle();
  const row = rowData as unknown as Record<string, string> | null;
  if (!row || row.org_id !== ctx.profile.orgId) return { error: "Item not found." };

  const { error } = await ctx.admin.from(t.table).update({ deleted_at: null, deleted_by: null }).eq("id", id).eq("org_id", ctx.profile.orgId);
  if (error) return { error: error.message };

  await logAudit({
    orgId: ctx.profile.orgId,
    actorId: ctx.profile.userId,
    actorName: ctx.profile.fullName,
    action: "restored",
    entityType: entity,
    entityId: id,
    entityLabel: row[t.label] ?? "",
  });
  revalidatePath("/settings");
  revalidatePath(t.path);
  return { error: null };
}

export async function purgeItem(entity: AuditEntity, id: string): Promise<{ error: string | null }> {
  const ctx = await ownerAndAdmin();
  if (!ctx) return { error: "Only the account owner can permanently delete items." };
  const t = TABLE[entity];
  const { data: rowData } = await ctx.admin.from(t.table).select("*").eq("id", id).maybeSingle();
  const row = rowData as unknown as Record<string, string> | null;
  if (!row || row.org_id !== ctx.profile.orgId) return { error: "Item not found." };

  // Only ever hard-delete something already in the trash.
  const { error } = await ctx.admin.from(t.table).delete().eq("id", id).eq("org_id", ctx.profile.orgId).not("deleted_at", "is", null);
  if (error) return { error: error.message };

  await logAudit({
    orgId: ctx.profile.orgId,
    actorId: ctx.profile.userId,
    actorName: ctx.profile.fullName,
    action: "purged",
    entityType: entity,
    entityId: id,
    entityLabel: row[t.label] ?? "",
  });
  revalidatePath("/settings");
  return { error: null };
}
