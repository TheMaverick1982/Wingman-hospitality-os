import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccessRole, PermissionOverrides } from "./permissions";
import { normalizeLang, type Lang } from "@/lib/i18n";

// Demo-only "Staff View" cookie: when set to "staff" on a demo org, the session
// is treated as the staff role so a sales rep can show the team-member experience.
export const DEMO_VIEW_COOKIE = "wm_demo_view";

export type CurrentProfile = {
  userId: string;
  email: string | undefined;
  fullName: string;
  accessRole: AccessRole;
  locationId: string | null;
  locationName: string | null;
  // IANA timezone of the user's home location (e.g. "America/New_York"), used to
  // compute the local business day for day-scoped features like checklists.
  // Null when the user has no home location or it has no timezone set.
  locationTimezone: string | null;
  orgId: string;
  orgName: string;
  isPlatformAdmin: boolean;
  platformAccess: string[];
  permissionOverrides: PermissionOverrides;
  allLocations: boolean;
  accessibleLocationIds: string[];
  // Any demo org (the shared sales-rep master OR an ephemeral visitor sandbox).
  isDemo: boolean;
  // Demo "View as staff" department: in a demo, the staff view can be shown as a
  // Server or a Chef so a rep can demo each role (e.g. the Chef's recipes). Null
  // outside a demo staff view. The staff experience resolves "my staff record" by
  // this department in demo mode instead of the single linked account.
  demoDept: string | null;
  // Only an ephemeral, self-serve visitor sandbox (has a demo_expires_at). The
  // shared wingmandemo master used for sales calls is NOT a sandbox, so
  // conversion nudges and the global demo AI cap key off this, not isDemo.
  isDemoSandbox: boolean;
  // The email a self-serve visitor entered at the demo gate (from the sandbox
  // user's metadata), used to pre-fill signup. Null outside sandboxes.
  demoLeadEmail: string | null;
  // The user's chosen UI language ('en' default). `languageChosen` is false
  // until they've picked one, which triggers the first-login language prompt.
  language: Lang;
  languageChosen: boolean;
  // Franchise: set when this user is a franchisor admin over a franchise group.
  // Gates the franchisor console + nav. Null for everyone else (the vast majority).
  franchiseGroupId: string | null;
  franchiseRole: "admin" | "viewer" | null;
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
  const [{ data }, { data: locRows }, { data: langRow }, { data: franchiseAdminRow }] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, access_role, location_id, org_id, is_platform_admin, platform_access, all_locations, locations!location_id(name, timezone), organizations(name, permission_overrides, is_demo, demo_expires_at)")
      .eq("id", user.id)
      .maybeSingle(),
    admin.from("profile_locations").select("location_id").eq("profile_id", user.id),
    // Language preference lives in its own guarded read so that if the migration
    // adding the column hasn't landed yet, a missing column can't break login —
    // it just degrades to English with no first-login prompt.
    admin.from("profiles").select("preferred_language").eq("id", user.id).maybeSingle(),
    // Franchise admin membership (guarded — pre-migration must not break login).
    admin.from("franchise_admins").select("group_id, role").eq("user_id", user.id).maybeSingle(),
  ]);
  const preferredLanguage = (langRow as { preferred_language?: string | null } | null)?.preferred_language ?? null;
  const franchiseRow = (franchiseAdminRow as { group_id: string; role: "admin" | "viewer" } | null) ?? null;

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
    locations: { name: string; timezone: string | null } | null;
    organizations: { name: string; permission_overrides: PermissionOverrides | null; is_demo: boolean | null; demo_expires_at: string | null } | null;
  };

  const base: CurrentProfile = {
    userId: user.id,
    email: user.email,
    fullName: profile.full_name,
    accessRole: profile.access_role,
    locationId: profile.location_id,
    locationName: profile.locations?.name ?? null,
    locationTimezone: profile.locations?.timezone ?? null,
    orgId: profile.org_id,
    orgName: profile.organizations?.name ?? "",
    isPlatformAdmin: profile.is_platform_admin,
    platformAccess: profile.platform_access ?? [],
    permissionOverrides: profile.organizations?.permission_overrides ?? {},
    allLocations: profile.all_locations ?? false,
    accessibleLocationIds: ((locRows ?? []) as { location_id: string }[]).map((r) => r.location_id),
    demoDept: null,
    isDemo: profile.organizations?.is_demo ?? false,
    isDemoSandbox: !!profile.organizations?.demo_expires_at,
    demoLeadEmail: (user.user_metadata?.lead_email as string | null) ?? null,
    language: normalizeLang(preferredLanguage),
    languageChosen: preferredLanguage != null,
    franchiseGroupId: franchiseRow?.group_id ?? null,
    franchiseRole: franchiseRow?.role ?? null,
  };

  // Demo-only "Staff View": on a demo org a sales rep can flip the session into
  // the staff role to show what a team member sees. Gated strictly to demo orgs
  // and read from an HttpOnly cookie, so it can never affect a real account.
  // (RLS still runs as the underlying owner — fine for a read-only showcase.)
  if (base.isDemo) {
    const cookieStore = await cookies();
    const view = cookieStore.get(DEMO_VIEW_COOKIE)?.value;
    // "server"/"chef" pick the role to demo; "staff" is the legacy value (= Server).
    if (view === "server" || view === "chef" || view === "staff") {
      const demoDept = view === "chef" ? "Chef" : "Server";
      return { ...base, accessRole: "staff", demoDept, allLocations: false, isPlatformAdmin: false, platformAccess: [] };
    }
  }

  return base;
}
