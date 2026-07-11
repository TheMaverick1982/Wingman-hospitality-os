import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  platformAccess: string[];
  permissionOverrides: PermissionOverrides;
  allLocations: boolean;
  accessibleLocationIds: string[];
  isDemo: boolean;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();

  // getUser() cryptographically validates the session cookie, so `user.id` is
  // trustworthy. We then load *that user's own* profile with the service-role
  // client, keyed strictly to their validated id. This is deliberate: the
  // cookie-authenticated query can silently run unauthenticated when the auth
  // cookie is chunked, and RLS would then hide the profile and bounce the user
  // to onboarding. Reading only your own row by a verified id can't leak data.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data }, { data: locRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, access_role, location_id, org_id, is_platform_admin, platform_access, all_locations, locations!location_id(name), organizations(name, permission_overrides, is_demo)")
      .eq("id", user.id)
      .maybeSingle(),
    admin.from("profile_locations").select("location_id").eq("profile_id", user.id),
  ]);

  if (!data) return null;
  // `Database` is a loose placeholder type today, so postgrest-js can't infer
  // that these embeds are single rows (many-to-one FKs) rather than arrays.
  const profile = data as unknown as {
    full_name: string;
    access_role: AccessRole;
    location_id: string | null;
    org_id: string;
    is_platform_admin: boolean;
    platform_access: string[] | null;
    all_locations: boolean;
    locations: { name: string } | null;
    organizations: { name: string; permission_overrides: PermissionOverrides | null; is_demo: boolean | null } | null;
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
    platformAccess: profile.platform_access ?? [],
    permissionOverrides: profile.organizations?.permission_overrides ?? {},
    allLocations: profile.all_locations ?? false,
    accessibleLocationIds: ((locRows ?? []) as { location_id: string }[]).map((r) => r.location_id),
    isDemo: profile.organizations?.is_demo ?? false,
  };
}
