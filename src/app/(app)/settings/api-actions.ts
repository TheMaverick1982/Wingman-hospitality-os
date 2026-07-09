"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { generateApiKey } from "@/lib/api-keys";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type CreateApiKeyState = { error: string | null; plaintext?: string };

export async function createApiKey(_prev: CreateApiKeyState, formData: FormData): Promise<CreateApiKeyState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can create API keys." };
  }

  const name = String(formData.get("name") || "").trim() || "Untitled key";
  const { plaintext, keyHash, keyPrefix } = generateApiKey();

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    org_id: profile.orgId,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  // The plaintext is returned exactly once and never stored anywhere.
  return { error: null, plaintext };
}

export async function revokeApiKey(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can revoke API keys." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}
