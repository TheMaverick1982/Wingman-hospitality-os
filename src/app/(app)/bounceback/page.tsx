import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import type { GuestWithVisits } from "@/lib/hospitality";
import { GuestsClient } from "./guests-client";

export default async function BounceBackPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "bounceback", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "bounceback", profile.permissionOverrides);

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const supabase = await createClient();
  const [{ data: guests }, locations] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "id, name, phone, email, referred_a_friend, guest_visits(visit_number, visit_date, location_id, incentive, notes, reaction)"
      )
      .order("created_at", { ascending: false }),
    getOrgLocations(),
  ]);

  // Honor the top-bar location selector: a guest belongs to the location of
  // their first visit (a regular at one store is a first-timer at another).
  // "All locations" (no effective location) shows every guest.
  const allGuests = (guests ?? []) as GuestWithVisits[];
  const scopedGuests = effectiveLocation
    ? allGuests.filter((g) => g.guest_visits.find((v) => v.visit_number === 1)?.location_id === effectiveLocation)
    : allGuests;
  const scopedLocationName = effectiveLocation ? (locations.find((l) => l.id === effectiveLocation)?.name ?? null) : null;

  return (
    <GuestsClient
      guests={scopedGuests}
      locations={locations}
      defaultLocationId={effectiveLocation ?? profile.locationId}
      canEdit={canEdit}
      scopedLocationName={scopedLocationName}
    />
  );
}
