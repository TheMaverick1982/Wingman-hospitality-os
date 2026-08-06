import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { ensureSurveyLinks } from "@/lib/guest-survey-links";
import { ReviewsClient, type ReviewRow, type SurveyLinkRow } from "./reviews-client";

export const metadata = { title: "Guest Reviews · Wingman" };

// The Guest Reviews archive: per-location survey share links (QR + short link)
// and every survey response. Read via the admin client scoped to the org (access
// is enforced here). Deliberately separate from Guest Bounce Back.
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) === "none") redirect("/dashboard");

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const admin = createAdminClient();
  const [links, locations, staff] = await Promise.all([
    ensureSurveyLinks(admin, profile.orgId),
    getOrgLocations(),
    getStaffMembers(null),
  ]);

  const locName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? "A location" : "");
  const staffFirstName = (id: string | null) => {
    if (!id) return "";
    const full = staff.find((s) => s.id === id)?.full_name ?? "";
    return full.trim().split(/\s+/)[0] || full;
  };

  // Share links, scoped to the selected location (or all).
  const linkRows: SurveyLinkRow[] = Array.from(links.values())
    .filter((l) => !effectiveLocation || l.location_id === effectiveLocation)
    .map((l) => ({ locationId: l.location_id, locationName: locName(l.location_id), code: l.code, scanCount: l.scan_count }))
    .sort((a, b) => a.locationName.localeCompare(b.locationName));

  // Responses archive.
  let q = admin
    .from("guest_survey_responses")
    .select("id, location_id, server_staff_id, ratings, comment, created_at")
    .eq("org_id", profile.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (effectiveLocation) q = q.eq("location_id", effectiveLocation);
  const { data: respRows } = await q;

  const responses: ReviewRow[] = ((respRows ?? []) as {
    id: string;
    location_id: string | null;
    server_staff_id: string | null;
    ratings: Record<string, number> | null;
    comment: string | null;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    locationName: locName(r.location_id),
    serverFirstName: staffFirstName(r.server_staff_id),
    ratings: r.ratings ?? {},
    comment: r.comment ?? "",
    createdAt: r.created_at,
  }));

  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

  return <ReviewsClient siteUrl={SITE} links={linkRows} responses={responses} />;
}
