import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { GuestsClient } from "./guests-client";

export default async function BounceBackPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "bounceback", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "bounceback", profile.permissionOverrides);

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

  return (
    <GuestsClient
      guests={guests ?? []}
      locations={locations}
      defaultLocationId={profile.locationId}
      canEdit={canEdit}
    />
  );
}
