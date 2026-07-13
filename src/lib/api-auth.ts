import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, looksLikeApiKey } from "@/lib/api-keys";

// keyLocationId: if the key is bound to one location, that's its fixed scope.
// null means an org-wide key (all locations), which may set a per-request
// location via the X-Wingman-Location header (or ?location=).
export type ApiCaller = { orgId: string; keyId: string; keyLocationId: string | null };

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
    .select("id, org_id, location_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!key || key.revoked_at) return null;

  // Best-effort "last used" stamp; never block the request on it.
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { orgId: key.org_id as string, keyId: key.id as string, keyLocationId: (key.location_id as string | null) ?? null };
}

// Resolve the location this request applies to, for multi-location scoping:
//   - A location-bound key is locked to its location. A header naming a
//     different location is rejected (it can't reach outside its store).
//   - An org-wide key may pass X-Wingman-Location: <id> (or ?location=<id>) to
//     scope the request; the location must belong to the org. No header => null
//     (org-wide / unscoped), same as before.
// Returns { locationId } on success or { error } (a ready NextResponse) on a bad
// location, so callers can `if (loc.error) return loc.error`.
export async function resolveApiLocation(
  request: Request,
  caller: ApiCaller
): Promise<{ locationId: string | null; error: NextResponse | null }> {
  const url = new URL(request.url);
  const requested = (request.headers.get("x-wingman-location") || url.searchParams.get("location") || "").trim() || null;

  if (caller.keyLocationId) {
    if (requested && requested !== caller.keyLocationId) {
      return { locationId: null, error: apiError("This key is locked to one location and can't target another.", 403) };
    }
    return { locationId: caller.keyLocationId, error: null };
  }

  if (!requested) return { locationId: null, error: null };

  const admin = createAdminClient();
  const { data: loc } = await admin.from("locations").select("id").eq("id", requested).eq("org_id", caller.orgId).maybeSingle();
  if (!loc) return { locationId: null, error: apiError("The requested location is not in your organization.") };
  return { locationId: requested, error: null };
}

export function apiUnauthorized() {
  return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
