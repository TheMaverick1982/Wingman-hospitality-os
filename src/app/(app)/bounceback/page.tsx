import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { GuestsClient } from "./guests-client";

export default async function BounceBackPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "bounceback") === "none") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: guests }, locations] = await Promise.all([
    supabase
      .from("guests")
      .select("id, name, phone, email, guest_visits(visit_number, visit_date, location_id, incentive, notes)")
      .order("created_at", { ascending: false }),
    getOrgLocations(),
  ]);

  return (
    <GuestsClient
      guests={guests ?? []}
      locations={locations}
      defaultLocationId={profile.locationId}
    />
  );
}
