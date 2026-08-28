import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccessRole } from "@/lib/auth/permissions";

export type Location = { id: string; name: string; address?: string; phone?: string; email?: string; timezone?: string };

export async function getOrgLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, name, address, phone, email, timezone").order("name");
  return data ?? [];
}

/**
 * Locations for a known org, read with the service-role client scoped strictly
 * to that org id.
 *
 * The always-mounted app shell (the top-bar location switcher + sidebar stat)
 * needs its location list to be rock-solid. The RLS `getOrgLocations()` gates on
 * `current_org_id()`, which is derived from the auth session — and that session
 * can momentarily read as anonymous when the auth cookie is chunked across a
 * navigation (the same failure `getCurrentProfile()` documents and avoids). When
 * it does, the RLS read returns zero rows, `switchableLocations` collapses to
 * empty, and the location switcher silently vanishes until a hard refresh — the
 * recurring "locations tab disappeared" bug.
 *
 * Because the caller already holds a validated `orgId` from the profile, reading
 * that org's locations by id can't leak across tenants and never blanks out.
 * Use this for the app shell; keep the RLS variant for in-page reads.
 */
export async function getOrgLocationsById(orgId: string): Promise<Location[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, name, address, phone, email, timezone")
    .eq("org_id", orgId)
    .order("name");
  return data ?? [];
}

export type LocationScopeInput = {
  accessRole: AccessRole;
  userLocationId: string | null;
  allLocations?: boolean;
  accessibleLocationIds?: string[];
};

/** A member who can see EVERY location in the org (owner or all-locations grant). */
export function spansAllLocations(i: LocationScopeInput): boolean {
  return i.accessRole === "super_admin" || Boolean(i.allLocations);
}

/** The concrete location ids a member may reach: their home + any explicit extras. */
export function reachableLocationIds(i: LocationScopeInput): string[] {
  return [i.userLocationId, ...(i.accessibleLocationIds ?? [])].filter(Boolean) as string[];
}

/**
 * The PostgREST `.or()` filter that scopes a per-location table to exactly what
 * a member may see for the current request — or `null` meaning "apply no filter"
 * (a member who spans all locations and hasn't narrowed to one store).
 *
 * This is the single source of truth for a bug this codebase kept re-introducing.
 * Reads done with the service-role (admin) client bypass RLS, and a few tables
 * (e.g. job_openings) don't gate on location in RLS at all — so this app-level
 * filter is the ONLY thing standing between a location-limited manager and every
 * other store's data. The trap: `resolveEffectiveLocation` returns `null` for a
 * specific-locations member on their default view (it means "all the stores I can
 * reach", not "every store"), so a query that filters ONLY when a location is
 * explicitly selected silently leaks the whole org to that manager. Here `null`
 * for a non-spanning member correctly collapses to their reachable set (plus
 * unassigned/no-location rows, so an applicant who didn't pick a store is kept).
 *
 * Apply as: `const or = locationScopeOr(i, eff); if (or) q = q.or(or);`
 */
export function locationScopeOr(i: LocationScopeInput, effectiveLocation: string | null): string | null {
  if (spansAllLocations(i)) return effectiveLocation ? `location_id.eq.${effectiveLocation}` : null;
  if (effectiveLocation) return `location_id.eq.${effectiveLocation},location_id.is.null`;
  return [...reachableLocationIds(i).map((id) => `location_id.eq.${id}`), "location_id.is.null"].join(",");
}

/**
 * Predicate form of {@link locationScopeOr} for filtering already-fetched rows in
 * JS (e.g. per-location cards). Unassigned (null) rows are always allowed for a
 * location-limited member — the same safety net as the query filter.
 */
export function canSeeLocation(i: LocationScopeInput, effectiveLocation: string | null, rowLocationId: string | null): boolean {
  if (spansAllLocations(i)) return !effectiveLocation || rowLocationId === effectiveLocation;
  if (rowLocationId === null) return true;
  if (effectiveLocation) return rowLocationId === effectiveLocation;
  return reachableLocationIds(i).includes(rowLocationId);
}

/**
 * Resolves the "effective location" for the current request.
 *   - A Super Admin, or a member with all-locations access, can pick any
 *     location (or "all") via the ?location= query param.
 *   - A member with specific extra locations can span those (and pick "all",
 *     which RLS scopes to just their accessible rows).
 *   - A plain single-location member is always locked to their own location.
 * Returning null means "no location filter" — RLS still limits the rows to
 * what the member is allowed to see, so it is always safe.
 */
export function resolveEffectiveLocation({
  accessRole,
  userLocationId,
  requestedLocationId,
  allLocations = false,
  accessibleLocationIds = [],
}: {
  accessRole: AccessRole;
  userLocationId: string | null;
  requestedLocationId: string | undefined;
  allLocations?: boolean;
  accessibleLocationIds?: string[];
}): string | null {
  const isOwnerOrAll = accessRole === "super_admin" || allLocations;
  const canSpanLocations = isOwnerOrAll || accessibleLocationIds.length > 0;
  if (!canSpanLocations) return userLocationId;
  if (!requestedLocationId || requestedLocationId === "all") return null;
  if (isOwnerOrAll) return requestedLocationId;
  // Specific-locations member: only honor a location they can actually reach.
  const allowed = new Set([userLocationId, ...accessibleLocationIds].filter(Boolean) as string[]);
  return allowed.has(requestedLocationId) ? requestedLocationId : null;
}
