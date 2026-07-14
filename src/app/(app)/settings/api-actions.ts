"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canManageApi } from "@/lib/auth/permissions";
import { generateApiKey } from "@/lib/api-keys";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  location_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type CreateApiKeyState = { error: string | null; plaintext?: string };

export async function createApiKey(_prev: CreateApiKeyState, formData: FormData): Promise<CreateApiKeyState> {
  const profile = await getCurrentProfile();
  if (!profile || !canManageApi(profile.accessRole)) {
    return { error: "Only a Super Admin or Developer can create API keys." };
  }

  const name = String(formData.get("name") || "").trim() || "Untitled key";

  // Optional: bind the key to one location (the POS at that store). Blank = an
  // org-wide key covering all locations. The api_keys table is RLS-restricted to
  // Super Admins, so writes go through the service-role client after the
  // app-level role check above (org is pinned to the caller's org).
  const supabase = createAdminClient();
  let locationId: string | null = null;
  const rawLocation = String(formData.get("locationId") || "").trim();
  if (rawLocation) {
    const { data: loc } = await supabase.from("locations").select("id").eq("id", rawLocation).eq("org_id", profile.orgId).maybeSingle();
    if (!loc) return { error: "That location isn't in your organization." };
    locationId = rawLocation;
  }

  const { plaintext, keyHash, keyPrefix } = generateApiKey();

  const { error } = await supabase.from("api_keys").insert({
    org_id: profile.orgId,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    location_id: locationId,
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/api-access");
  // The plaintext is returned exactly once and never stored anywhere.
  return { error: null, plaintext };
}

export async function revokeApiKey(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || !canManageApi(profile.accessRole)) {
    return { error: "Only a Super Admin or Developer can revoke API keys." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/api-access");
  return { error: null };
}
