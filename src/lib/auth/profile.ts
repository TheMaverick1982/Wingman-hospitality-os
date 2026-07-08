import { createClient } from "@/lib/supabase/server";
import type { AccessRole, PermissionOverrides } from "./permissions";

export type CurrentProfile = {
  userId: string;
  email: string | undefined;
  fullName: string;
  accessRole: AccessRole;
  locationId: string | null;
  locationName: string | null;
  orgId: string;
  orgName: string;
  isPlatformAdmin: boolean;
  permissionOverrides: PermissionOverrides;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("full_name, access_role, location_id, org_id, is_platform_admin, locations(name), organizations(name, permission_overrides)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  // `Database` is a loose placeholder type today, so postgrest-js can't infer
  // that these embeds are single rows (many-to-one FKs) rather than arrays.
  const profile = data as unknown as {
    full_name: string;
    access_role: AccessRole;
    location_id: string | null;
    org_id: string;
    is_platform_admin: boolean;
    locations: { name: string } | null;
    organizations: { name: string; permission_overrides: PermissionOverrides | null } | null;
  };

  return {
    userId: user.id,
    email: user.email,
    fullName: profile.full_name,
    accessRole: profile.access_role,
    locationId: profile.location_id,
    locationName: profile.locations?.name ?? null,
    orgId: profile.org_id,
    orgName: profile.organizations?.name ?? "",
    isPlatformAdmin: profile.is_platform_admin,
    permissionOverrides: profile.organizations?.permission_overrides ?? {},
  };
}
