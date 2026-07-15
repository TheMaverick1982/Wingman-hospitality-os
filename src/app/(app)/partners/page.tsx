import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import type { PartnerActivity, PartnerContact, PartnerGoal } from "@/lib/partners";
import { resolveGoal } from "@/lib/partners";
import { PartnersClient } from "./partners-client";

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "partners", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "partners", profile.permissionOverrides);

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const supabase = await createClient();
  const [{ data: contactRows }, { data: activityRows }, { data: profileRows }, { data: goalRows }, locations] = await Promise.all([
    supabase
      .from("partner_contacts")
      .select(
        "id, location_id, company_name, contact_name, title, email, phone, category, subcategory, website, address, notes, status, last_activity_at, created_by, created_at"
      )
      .order("company_name"),
    supabase
      .from("partner_activities")
      .select("id, contact_id, location_id, activity_date, activity_type, notes, revenue_cents, created_by, created_at, partner_contacts(company_name)")
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("partner_goals").select("location_id, goal_new_contacts, goal_events, goal_fundraisers, goal_active_connections"),
    getOrgLocations(),
  ]);

  // RLS already scopes rows to the locations this user can reach; the top-bar
  // location selector narrows further to a single store when one is chosen.
  const allContacts = (contactRows ?? []) as PartnerContact[];
  const scopedContacts = effectiveLocation ? allContacts.filter((c) => c.location_id === effectiveLocation) : allContacts;

  type ActivityRow = PartnerActivity & { partner_contacts: { company_name: string } | { company_name: string }[] | null };
  const allActivities = (activityRows ?? []) as ActivityRow[];
  const scopedActivities = (effectiveLocation ? allActivities.filter((a) => a.location_id === effectiveLocation) : allActivities).map(
    (a) => {
      const embed = Array.isArray(a.partner_contacts) ? a.partner_contacts[0] : a.partner_contacts;
      return { ...a, companyName: embed?.company_name ?? "—" };
    }
  );

  const whoById = new Map(((profileRows ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  // Locations this user can file a contact under. Owners (and all-locations
  // members) get every store; a manager gets only their assigned set.
  const canSpanAll = profile.accessRole === "super_admin" || profile.allLocations;
  const accessible = new Set([profile.locationId, ...profile.accessibleLocationIds].filter(Boolean) as string[]);
  const assignableLocations = canSpanAll ? locations : locations.filter((l) => accessible.has(l.id));

  const scopedLocationName = effectiveLocation ? (locations.find((l) => l.id === effectiveLocation)?.name ?? null) : null;

  // Resolve goal targets for the current view. For a single store, its own
  // (or the org-default) target. In All-Locations mode, sum each visible store's
  // target so aggregate progress compares against the combined goal.
  const goals = (goalRows ?? []) as PartnerGoal[];
  const orgDefaultGoal = goals.find((g) => g.location_id === null) ?? null;
  const goalByLocation = new Map(goals.filter((g) => g.location_id).map((g) => [g.location_id as string, g]));
  const targetFor = (locId: string | null) => resolveGoal(goalByLocation, orgDefaultGoal, locId);
  const goalTargets = effectiveLocation
    ? targetFor(effectiveLocation)
    : (assignableLocations.length ? assignableLocations : locations).reduce(
        (acc, l) => {
          const g = targetFor(l.id);
          return {
            goal_new_contacts: acc.goal_new_contacts + g.goal_new_contacts,
            goal_events: acc.goal_events + g.goal_events,
            goal_fundraisers: acc.goal_fundraisers + g.goal_fundraisers,
            goal_active_connections: acc.goal_active_connections + g.goal_active_connections,
          };
        },
        { goal_new_contacts: 0, goal_events: 0, goal_fundraisers: 0, goal_active_connections: 0 }
      );

  return (
    <PartnersClient
      contacts={scopedContacts}
      activities={scopedActivities.map((a) => ({
        id: a.id,
        contact_id: a.contact_id,
        location_id: a.location_id,
        activity_date: a.activity_date,
        activity_type: a.activity_type,
        notes: a.notes,
        revenue_cents: a.revenue_cents,
        created_by: a.created_by,
        created_at: a.created_at,
        companyName: a.companyName,
        loggedBy: a.created_by ? (whoById.get(a.created_by) ?? "") : "",
      }))}
      locations={locations}
      assignableLocations={assignableLocations}
      defaultLocationId={effectiveLocation ?? profile.locationId}
      canEdit={canEdit}
      canPickOrgWide={profile.accessRole === "super_admin"}
      scopedLocationName={scopedLocationName}
      showLocationBadges={!effectiveLocation}
      goalTargets={goalTargets}
    />
  );
}
