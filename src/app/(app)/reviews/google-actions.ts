"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { gbpListLocations, type GbpAccountRow } from "@/lib/google-business";
import { syncLocationReviews } from "@/lib/google-review-sync";

async function guard() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." as const, profile: null };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "You don't have access to manage reviews." as const, profile: null };
  }
  return { error: null, profile };
}

export type ConnectableLocation = { accountRowId: string; googleAccountId: string; googleLocationId: string; title: string; address: string };

// Every Google Business location the org's connected account(s) can manage, for
// the map-to-Wingman-location picker.
export async function listConnectableGoogleLocations(): Promise<{ error: string | null; locations?: ConnectableLocation[]; accountEmail?: string }> {
  const { error, profile } = await guard();
  if (error || !profile) return { error: error ?? "Not authorized." };
  const admin = createAdminClient();
  const { data: accs } = await admin.from("google_business_accounts").select("*").eq("org_id", profile.orgId);
  const accounts = (accs ?? []) as GbpAccountRow[];
  if (accounts.length === 0) return { error: "No Google account connected yet." };

  const out: ConnectableLocation[] = [];
  for (const acc of accounts) {
    const res = await gbpListLocations(acc);
    if (res.error) return { error: res.error };
    for (const l of res.locations ?? []) {
      out.push({ accountRowId: acc.id, googleAccountId: l.accountId, googleLocationId: l.locationId, title: l.title, address: l.address });
    }
  }
  return { error: null, locations: out, accountEmail: accounts[0]?.email };
}

// Map a Wingman location to a Google Business location, then pull its reviews.
export async function connectGoogleLocation(input: {
  locationId: string;
  accountRowId: string;
  googleAccountId: string;
  googleLocationId: string;
  title: string;
}): Promise<{ error: string | null }> {
  const { error, profile } = await guard();
  if (error || !profile) return { error: error ?? "Not authorized." };
  const admin = createAdminClient();

  // The Wingman location must belong to this org.
  const { data: loc } = await admin.from("locations").select("id").eq("id", input.locationId).eq("org_id", profile.orgId).maybeSingle();
  if (!loc) return { error: "Location not found." };

  const { error: upErr } = await admin.from("google_review_locations").upsert(
    {
      org_id: profile.orgId,
      location_id: input.locationId,
      account_id: input.accountRowId,
      google_account_id: input.googleAccountId,
      google_location_id: input.googleLocationId,
      location_title: input.title,
    },
    { onConflict: "org_id,location_id" },
  );
  if (upErr) return { error: upErr.message };

  const sync = await syncLocationReviews(profile.orgId, input.locationId);
  revalidatePath("/reviews");
  // A sync error isn't fatal to the connection — surface it but keep the mapping.
  return { error: sync.error };
}

export async function refreshGoogleLocation(locationId: string): Promise<{ error: string | null; count?: number }> {
  const { error, profile } = await guard();
  if (error || !profile) return { error: error ?? "Not authorized." };
  const res = await syncLocationReviews(profile.orgId, locationId);
  revalidatePath("/reviews");
  return res;
}

export async function disconnectGoogleLocation(locationId: string): Promise<{ error: string | null }> {
  const { error, profile } = await guard();
  if (error || !profile) return { error: error ?? "Not authorized." };
  const admin = createAdminClient();
  await admin.from("google_reviews").delete().eq("org_id", profile.orgId).eq("location_id", locationId);
  await admin.from("google_review_locations").delete().eq("org_id", profile.orgId).eq("location_id", locationId);
  revalidatePath("/reviews");
  return { error: null };
}

// Remove a whole Google account connection (and every location mapping under it).
export async function disconnectGoogleAccount(): Promise<{ error: string | null }> {
  const { error, profile } = await guard();
  if (error || !profile) return { error: error ?? "Not authorized." };
  const admin = createAdminClient();
  // Cascade handles review_locations; reviews are keyed by location, clear them too.
  await admin.from("google_reviews").delete().eq("org_id", profile.orgId);
  await admin.from("google_business_accounts").delete().eq("org_id", profile.orgId);
  revalidatePath("/reviews");
  return { error: null };
}
