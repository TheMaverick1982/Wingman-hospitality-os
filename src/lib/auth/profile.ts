import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  userId: string;
  email: string | undefined;
  fullName: string;
  accessRole: "gm" | "manager";
  locationId: string | null;
  locationName: string | null;
  orgId: string;
  orgName: string;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("full_name, access_role, location_id, org_id, locations(name), organizations(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  // `Database` is a loose placeholder type today, so postgrest-js can't infer
  // that these embeds are single rows (many-to-one FKs) rather than arrays.
  const profile = data as unknown as {
    full_name: string;
    access_role: "gm" | "manager";
    location_id: string | null;
    org_id: string;
    locations: { name: string } | null;
    organizations: { name: string } | null;
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
  };
}
