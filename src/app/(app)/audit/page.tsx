import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import type { AuditRecord } from "@/lib/audit";
import { AuditClient } from "./audit-client";

// The audit action calls the model to build the action plan; give it room to
// finish instead of hitting the platform's short default function timeout.
export const maxDuration = 60;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "audit", profile.permissionOverrides) === "none") redirect("/dashboard");

  const { location } = await searchParams;
  // Audits are per-location. Honor the top-bar location switcher: a specific
  // location shows only its audits; "All locations" shows every audit.
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const supabase = await createClient();
  let auditsQ = supabase
    .from("audits")
    .select("id, occurred_on, location_id, health_score, audit_score, gap_scores, domain_scores, action_plan")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (effectiveLocation) auditsQ = auditsQ.eq("location_id", effectiveLocation);

  const [{ data: audits }, locations] = await Promise.all([auditsQ, getOrgLocations()]);

  return (
    <AuditClient
      audits={(audits ?? []) as AuditRecord[]}
      locations={locations}
      canEdit={canEditSection(profile.accessRole, "audit", profile.permissionOverrides)}
      isSuperAdmin={profile.accessRole === "super_admin"}
      defaultLocationId={effectiveLocation ?? profile.locationId}
      lockedLocationName={profile.locationName}
    />
  );
}
