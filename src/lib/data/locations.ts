import { createClient } from "@/lib/supabase/server";
import type { AccessRole } from "@/lib/auth/permissions";

export type Location = { id: string; name: string; address?: string; phone?: string; email?: string; timezone?: string };

export async function getOrgLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, name, address, phone, email, timezone").order("name");
  return data ?? [];
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
