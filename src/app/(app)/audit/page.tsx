import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import type { AuditRecord } from "@/lib/audit";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "audit", profile.permissionOverrides) === "none") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: audits }, locations] = await Promise.all([
    supabase
      .from("audits")
      .select("id, occurred_on, location_id, health_score, audit_score, gap_scores, domain_scores, action_plan")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    getOrgLocations(),
  ]);

  return (
    <AuditClient
      audits={(audits ?? []) as AuditRecord[]}
      locations={locations}
      canEdit={canEditSection(profile.accessRole, "audit", profile.permissionOverrides)}
      isSuperAdmin={profile.accessRole === "super_admin"}
      defaultLocationId={profile.locationId}
      lockedLocationName={profile.locationName}
    />
  );
}
