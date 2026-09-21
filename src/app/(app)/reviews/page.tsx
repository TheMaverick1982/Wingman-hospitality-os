import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { getOrgLocations, resolveEffectiveLocation, locationScopeOr, canSeeLocation } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { ensureSurveyLinks } from "@/lib/guest-survey-links";
import { gbpConfigured } from "@/lib/google-business";
import { ReviewsClient, type ReviewRow, type SurveyLinkRow } from "./reviews-client";
import { GoogleReviewsPanel, type GoogleLocationRow, type GoogleReviewLite, type ReviewInsightLite } from "./google-reviews-panel";
import { GuestNav } from "@/components/guests/guest-nav";

export const metadata = { title: "Guest Reviews · Wingman" };

// The "Send a test now" ownership-recap action fans out an AI summary per
// location; give it room to finish instead of the platform's short default.
export const maxDuration = 120;

// The Guest Reviews archive: per-location survey share links (QR + short link)
// and every survey response. Read via the admin client scoped to the org (access
// is enforced here). Deliberately separate from Guest Bounce Back.
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const access = getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides);
  if (access === "none") redirect("/dashboard");
  const canManage = access === "full";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  // Reviews are read with the admin client (guest surveys + Google reviews live
  // beside deny-all token columns), so RLS never runs — this app-level scope is
  // the only per-location guard. locationScopeOr collapses a specific-locations
  // manager's default (null) view to their reachable stores, never the whole org.
  const locScope = {
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  };
  const scopeOr = locationScopeOr(locScope, effectiveLocation);

  const admin = createAdminClient();
  const [links, locations, staff] = await Promise.all([
    ensureSurveyLinks(admin, profile.orgId),
    getOrgLocations(),
    getStaffMembers(null),
  ]);

  // The "ask who served them" survey switch. Guarded — the column lands with
  // migration 0162, so default to on until it's applied.
  let askServer = true;
  let digestFrequency: "off" | "weekly" | "monthly" = "off";
  let digestCc = "";
  let execFrequency: "off" | "daily" | "weekly" = "off";
  let execEmails = "";
  let execIncludeActions = true;
  {
    const { data, error } = await admin.from("organizations").select("survey_ask_server, review_digest_frequency, review_digest_cc, review_exec_frequency, review_exec_emails, review_exec_include_actions").eq("id", profile.orgId).maybeSingle();
    if (!error && data) {
      askServer = (data as { survey_ask_server?: boolean }).survey_ask_server !== false;
      const f = (data as { review_digest_frequency?: string }).review_digest_frequency;
      if (f === "weekly" || f === "monthly") digestFrequency = f;
      digestCc = (data as { review_digest_cc?: string | null }).review_digest_cc ?? "";
      const ef = (data as { review_exec_frequency?: string }).review_exec_frequency;
      if (ef === "daily" || ef === "weekly") execFrequency = ef;
      execEmails = (data as { review_exec_emails?: string | null }).review_exec_emails ?? "";
      execIncludeActions = (data as { review_exec_include_actions?: boolean }).review_exec_include_actions !== false;
    }
  }

  const locName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? "A location" : "");
  const staffFirstName = (id: string | null) => {
    if (!id) return "";
    const full = staff.find((s) => s.id === id)?.full_name ?? "";
    return full.trim().split(/\s+/)[0] || full;
  };

  // Share links, scoped to what this member may see (a specific-locations manager
  // gets only their stores, not every store's link).
  const linkRows: SurveyLinkRow[] = Array.from(links.values())
    .filter((l) => canSeeLocation(locScope, effectiveLocation, l.location_id))
    .map((l) => ({ locationId: l.location_id, locationName: locName(l.location_id), code: l.code, scanCount: l.scan_count }))
    .sort((a, b) => a.locationName.localeCompare(b.locationName));

  // Responses archive.
  let q = admin
    .from("guest_survey_responses")
    .select("id, location_id, server_staff_id, ratings, comment, created_at, recognized_at")
    .eq("org_id", profile.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (scopeOr) q = q.or(scopeOr);
  const { data: respRows } = await q;

  const responses: ReviewRow[] = ((respRows ?? []) as {
    id: string;
    location_id: string | null;
    server_staff_id: string | null;
    ratings: Record<string, number> | null;
    comment: string | null;
    created_at: string;
    recognized_at?: string | null;
  }[]).map((r) => ({
    id: r.id,
    locationName: locName(r.location_id),
    serverFirstName: staffFirstName(r.server_staff_id),
    hasServer: !!r.server_staff_id,
    recognized: !!r.recognized_at,
    ratings: r.ratings ?? {},
    comment: r.comment ?? "",
    createdAt: r.created_at,
  }));

  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

  // Google Business Profile reviews: connection state, per-location mapping +
  // cached rating / AI insight, and a few recent reviews. All via the admin
  // client (tokens live in a deny-all table; only non-secret fields are read).
  const gConfigured = gbpConfigured();
  const { data: acctRows } = await admin.from("google_business_accounts").select("email").eq("org_id", profile.orgId);
  const googleAccountEmails = ((acctRows ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);

  const { data: gMapRows } = await admin
    .from("google_review_locations")
    .select("location_id, location_title, average_rating, review_count, last_synced_at, last_sync_status, insight, insight_generated_at")
    .eq("org_id", profile.orgId);
  const gMapByLoc = new Map(
    ((gMapRows ?? []) as {
      location_id: string; location_title: string | null; average_rating: number | null; review_count: number;
      last_synced_at: string | null; last_sync_status: string | null; insight: ReviewInsightLite | null; insight_generated_at: string | null;
    }[]).map((m) => [m.location_id, m]),
  );

  const reviewsByLocation: Record<string, GoogleReviewLite[]> = {};
  if (gMapByLoc.size > 0) {
    let grq = admin
      .from("google_reviews")
      .select("id, location_id, reviewer_name, star_rating, comment, reply_comment, review_created_at")
      .eq("org_id", profile.orgId)
      .order("review_created_at", { ascending: false })
      .limit(effectiveLocation ? 25 : 80);
    if (scopeOr) grq = grq.or(scopeOr);
    const { data: grRows } = await grq;
    for (const r of (grRows ?? []) as { id: string; location_id: string; reviewer_name: string; star_rating: number; comment: string; reply_comment: string | null; review_created_at: string | null }[]) {
      const list = (reviewsByLocation[r.location_id] ??= []);
      if (list.length < 8) list.push({ id: r.id, reviewerName: r.reviewer_name, stars: r.star_rating, comment: r.comment, reply: r.reply_comment, createdAt: r.review_created_at });
    }
  }

  // One row per Wingman location this member may see, connected or not.
  const googleRows: GoogleLocationRow[] = locations
    .filter((l) => canSeeLocation(locScope, effectiveLocation, l.id))
    .map((l) => {
      const m = gMapByLoc.get(l.id);
      return {
        locationId: l.id,
        locationName: l.name,
        connected: Boolean(m),
        title: m?.location_title ?? null,
        averageRating: m?.average_rating ?? null,
        reviewCount: m?.review_count ?? 0,
        lastSyncedAt: m?.last_synced_at ?? null,
        lastSyncStatus: m?.last_sync_status ?? null,
        insight: m?.insight ?? null,
        insightGeneratedAt: m?.insight_generated_at ?? null,
      };
    });

  const showGoogle = canManage || googleAccountEmails.length > 0;
  const hasGoogleReviews = Array.from(gMapByLoc.values()).some((m) => (m.review_count ?? 0) > 0);

  return (
    <>
      <GuestNav />
      <ReviewsClient
      siteUrl={SITE}
      links={linkRows}
      responses={responses}
      canManage={canManage}
      isSuperAdmin={profile.accessRole === "super_admin"}
      askServer={askServer}
      hasGoogleReviews={hasGoogleReviews}
      digestFrequency={digestFrequency}
      digestCc={digestCc}
      execFrequency={execFrequency}
      execEmails={execEmails}
      execIncludeActions={execIncludeActions}
      scopeLocationId={effectiveLocation ?? null}
      googleSlot={
        showGoogle ? (
          <GoogleReviewsPanel
            configured={gConfigured}
            accountEmails={googleAccountEmails}
            rows={googleRows}
            reviewsByLocation={reviewsByLocation}
            canManage={canManage}
          />
        ) : null
      }
      />
    </>
  );
}
