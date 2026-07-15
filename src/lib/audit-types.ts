// Client-safe audit types + labels (no server-only imports), so client
// components can use them. The logAudit writer lives in audit-log.ts (server).

export type AuditAction = "deleted" | "restored" | "purged";
export type AuditEntity = "guest" | "partner" | "staff";

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  guest: "Guest",
  partner: "Partner contact",
  staff: "Staff member",
};
