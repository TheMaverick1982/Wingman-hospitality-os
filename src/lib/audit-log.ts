import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditAction, AuditEntity } from "@/lib/audit-types";

export type { AuditAction, AuditEntity };

// Record a destructive action to the org's audit trail. Never throws — a
// logging failure must not break the underlying delete/restore.
export async function logAudit(opts: {
  orgId: string;
  actorId?: string | null;
  actorName?: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  entityLabel?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      org_id: opts.orgId,
      actor_id: opts.actorId ?? null,
      actor_name: opts.actorName ?? "",
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      entity_label: (opts.entityLabel ?? "").slice(0, 200),
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
