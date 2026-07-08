import { createClient } from "@/lib/supabase/server";
import type { AccessRole } from "@/lib/auth/permissions";

export type Location = { id: string; name: string; address?: string; phone?: string; email?: string };

export async function getOrgLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, name, address, phone, email").order("name");
  return data ?? [];
}

/**
 * Resolves the "effective location" for the current request: Managers and
 * Staff are always locked to their own location regardless of the URL,
 * while a Super Admin can pick any location (or "all") via the ?location=
 * query param.
 */
export function resolveEffectiveLocation({
  accessRole,
  userLocationId,
  requestedLocationId,
}: {
  accessRole: AccessRole;
  userLocationId: string | null;
  requestedLocationId: string | undefined;
}): string | null {
  if (accessRole !== "super_admin") return userLocationId;
  if (!requestedLocationId || requestedLocationId === "all") return null;
  return requestedLocationId;
}
