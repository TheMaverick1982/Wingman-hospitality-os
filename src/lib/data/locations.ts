import { createClient } from "@/lib/supabase/server";

export type Location = { id: string; name: string };

export async function getOrgLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, name").order("name");
  return data ?? [];
}

/**
 * Resolves the "effective location" for the current request: a Store Manager
 * is always locked to their own location regardless of the URL, while a GM
 * can pick any location (or "all") via the ?location= query param.
 */
export function resolveEffectiveLocation({
  accessRole,
  userLocationId,
  requestedLocationId,
}: {
  accessRole: "gm" | "manager";
  userLocationId: string | null;
  requestedLocationId: string | undefined;
}): string | null {
  if (accessRole === "manager") return userLocationId;
  if (!requestedLocationId || requestedLocationId === "all") return null;
  return requestedLocationId;
}
