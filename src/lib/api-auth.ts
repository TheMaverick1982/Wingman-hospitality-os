import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, looksLikeApiKey } from "@/lib/api-keys";

export type ApiCaller = { orgId: string; keyId: string };

// Authenticates an API request by its Bearer key and returns the org the key
// belongs to. The org is derived ENTIRELY from the key -- callers can never
// pass an org id -- so one customer's key can only ever touch its own data.
export async function authenticateApiKey(request: Request): Promise<ApiCaller | null> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const plaintext = match[1].trim();
  if (!looksLikeApiKey(plaintext)) return null;

  const keyHash = hashApiKey(plaintext);
  const admin = createAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!key || key.revoked_at) return null;

  // Best-effort "last used" stamp; never block the request on it.
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { orgId: key.org_id as string, keyId: key.id as string };
}

export function apiUnauthorized() {
  return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
