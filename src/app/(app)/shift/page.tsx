import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getSectionAccess } from "@/lib/auth/permissions";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { localDate } from "@/lib/local-date";
import { ShiftClient, type ShiftNoteRow } from "./shift-client";
import { ShiftFeedbackSection, type ShiftFeedbackRow } from "./shift-feedback-section";

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

  // The board is a daily tool — keep it to the last 7 local days so it stays
  // short and current instead of growing into an endless archive. (The dashboard
  // "Today on shift" card already shows only today.)
  const todayStr = localDate(profile.locationTimezone);
  const weekAgoStr = new Date(new Date(todayStr + "T00:00:00").getTime() - 7 * 86400000).toISOString().slice(0, 10);

  let q = supabase
    .from("shift_board_notes")
    .select("id, kind, body, author_name, business_day, location_id, created_at")
    .is("deleted_at", null)
    .gte("business_day", weekAgoStr)
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

  // Post-shift feedback (Slice 2). Managers read the whole feed; every viewer's
  // own "already checked in today" is looked up so the composer can confirm it.
  // Guarded so a not-yet-applied migration can't break the page.
  let feedback: ShiftFeedbackRow[] = [];
  let alreadySubmitted = false;
  try {
    if (canPost) {
      let fq = supabase
        .from("shift_feedback")
        .select("id, author_name, department, went_well, improve, guest_notes, business_day, location_id, created_at")
        .is("deleted_at", null)
        .order("business_day", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(80);
      if (effectiveLocation) fq = fq.eq("location_id", effectiveLocation);
      const { data: fData } = await fq;
      feedback = ((fData ?? []) as {
        id: string; author_name: string; department: string; went_well: string; improve: string; guest_notes: string; business_day: string; location_id: string;
      }[]).map((f) => ({
        id: f.id,
        author: f.author_name,
        department: f.department ?? "",
        wentWell: f.went_well ?? "",
        improve: f.improve ?? "",
        guestNotes: f.guest_notes ?? "",
        businessDay: f.business_day,
        locationName: locName(f.location_id),
      }));
    }
    const { data: mine } = await supabase
      .from("shift_feedback")
      .select("id")
      .eq("author_id", profile.userId)
      .eq("business_day", todayStr)
      .is("deleted_at", null)
      .limit(1);
    alreadySubmitted = (mine?.length ?? 0) > 0;
  } catch {
    feedback = [];
    alreadySubmitted = false;
  }

  return (
    <div className="flex flex-col gap-10 max-w-3xl">
      <ShiftClient
        notes={notes}
        canPost={canPost}
        todayStr={todayStr}
        locations={pickable.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={effectiveLocation ?? profile.locationId ?? pickable[0]?.id ?? ""}
        showLocation={effectiveLocation === null}
      />
      <ShiftFeedbackSection
        canReadFeedback={canPost}
        alreadySubmitted={alreadySubmitted}
        submitLocationId={effectiveLocation ?? profile.locationId ?? pickable[0]?.id ?? ""}
        feedback={feedback}
        todayStr={todayStr}
        showLocation={effectiveLocation === null}
      />
    </div>
  );
}
