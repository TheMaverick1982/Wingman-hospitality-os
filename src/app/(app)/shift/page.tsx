import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getSectionAccess } from "@/lib/auth/permissions";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { localDate } from "@/lib/local-date";
import { ShiftClient, type ShiftNoteRow } from "./shift-client";

export const metadata = { title: "Shift · Wingman" };

// Shift board: the day's 86'd items, staffing changes, and notes. Managers/
// shift-leads post; all staff read. Archives by local business day.
export default async function ShiftPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const access = getSectionAccess(profile.accessRole, "shift", profile.permissionOverrides);
  if (access === "none") redirect("/dashboard");
  const canPost = access === "full";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const supabase = await createClient();
  const locations = await getOrgLocations();

  let q = supabase
    .from("shift_board_notes")
    .select("id, kind, body, author_name, business_day, location_id, created_at")
    .is("deleted_at", null)
    .order("business_day", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);
  if (effectiveLocation) q = q.eq("location_id", effectiveLocation);
  const { data } = await q;

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "A location";
  const notes: ShiftNoteRow[] = ((data ?? []) as {
    id: string; kind: string; body: string; author_name: string; business_day: string; location_id: string; created_at: string;
  }[]).map((n) => ({
    id: n.id,
    kind: n.kind,
    body: n.body,
    author: n.author_name,
    businessDay: n.business_day,
    locationName: locName(n.location_id),
  }));

  const canSpan =
    profile.accessRole === "super_admin" || profile.allLocations || profile.accessibleLocationIds.length > 0;
  const pickable = canSpan
    ? locations
    : locations.filter((l) => l.id === profile.locationId || profile.accessibleLocationIds.includes(l.id));

  return (
    <ShiftClient
      notes={notes}
      canPost={canPost}
      todayStr={localDate(profile.locationTimezone)}
      locations={pickable.map((l) => ({ id: l.id, name: l.name }))}
      defaultLocationId={effectiveLocation ?? profile.locationId ?? pickable[0]?.id ?? ""}
      showLocation={effectiveLocation === null}
    />
  );
}
