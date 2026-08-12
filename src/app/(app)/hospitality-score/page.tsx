import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess, isManagerOrAbove } from "@/lib/auth/permissions";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { ScoreClient, type AssessmentRow } from "./score-client";

export const metadata = { title: "Hospitality Score · Wingman" };

// The Hospitality Score self-assessment + history, scoped by location. With the
// header location switcher on "All locations" this is the whole-company score;
// pick a location and it's that location's own score. Shown to the Reporting
// audience (owner full, manager view); the owner takes the company-wide one, and
// a location's manager can take that location's.
export default async function HospitalityScorePage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const access = getSectionAccess(profile.accessRole, "reporting", profile.permissionOverrides);
  if (access === "none") redirect("/dashboard");

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const locations = await getOrgLocations();
  const scopeLabel = effectiveLocation ? (locations.find((l) => l.id === effectiveLocation)?.name ?? "This location") : "All locations";
  const multiLocation = locations.length > 1;

  // Who may record this scope: the company-wide (null) score is owner-only; a
  // specific location's score can be taken by the owner or a manager with access
  // (effectiveLocation is already clamped to what this user can reach).
  const canTake = effectiveLocation === null
    ? profile.accessRole === "super_admin"
    : isManagerOrAbove(profile.accessRole);

  const admin = createAdminClient();
  let q = admin
    .from("hospitality_assessments")
    .select("id, scores, total, created_at")
    .eq("org_id", profile.orgId)
    .order("created_at", { ascending: false })
    .limit(12);
  q = effectiveLocation ? q.eq("location_id", effectiveLocation) : q.is("location_id", null);
  const { data } = await q;
  const history: AssessmentRow[] = ((data ?? []) as { id: string; scores: number[] | null; total: number; created_at: string }[])
    .map((r) => ({ id: r.id, scores: Array.isArray(r.scores) ? r.scores : [], total: r.total, createdAt: r.created_at }));

  return (
    <ScoreClient
      canTake={canTake}
      history={history}
      scopeLocationId={effectiveLocation}
      scopeLabel={scopeLabel}
      multiLocation={multiLocation}
    />
  );
}
