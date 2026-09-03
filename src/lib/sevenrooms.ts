import "server-only";

// Thin SevenRooms client. SevenRooms is a reservation + guest-CRM platform with a
// PARTNER API — you apply to their partner program and receive client
// credentials (client id + secret). Like Toast, this is machine-to-machine: we
// log in once with those credentials for a short-lived token, then scope each
// data request to a venue by its Venue ID. A venue "connects" by the operator
// enabling Wingman / sharing their Venue ID — there is no per-user OAuth redirect.
//
// Everything about the transport (base host, version segment, paths, auth header
// scheme) is env-overridable, because the exact endpoints/field shapes must be
// confirmed against the live partner API during go-live testing. Defaults reflect
// SevenRooms' documented v2_4 API; adjust via env without a code change.
// Docs / partner program: https://www.sevenrooms.com/en/integrations (see notes
// in the settings card and the go-live checklist).

export const SR_ENV = (process.env.SEVENROOMS_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = SR_ENV !== "production";

// SevenRooms serves auth + data from the same host. Override if the partner
// account is issued a different host.
export const SR_API_BASE = (process.env.SEVENROOMS_API_BASE ?? "https://api.sevenrooms.com").replace(/\/$/, "");
// API version segment (SevenRooms versions its API in the path, e.g. "2_4").
const SR_VERSION = process.env.SEVENROOMS_API_VERSION ?? "2_4";

// Overridable paths in case SevenRooms moves them.
const AUTH_PATH = process.env.SEVENROOMS_AUTH_PATH ?? `/${SR_VERSION}/auth`;
const VENUE_PATH = process.env.SEVENROOMS_VENUE_PATH ?? `/${SR_VERSION}/venues`; // + /{venueId}
export const SR_CLIENTS_PATH = process.env.SEVENROOMS_CLIENTS_PATH ?? `/${SR_VERSION}/clients`;
export const SR_RESERVATIONS_PATH = process.env.SEVENROOMS_RESERVATIONS_PATH ?? `/${SR_VERSION}/reservations`;

const SR_CLIENT_ID = (process.env.SEVENROOMS_CLIENT_ID ?? "").trim();
const SR_CLIENT_SECRET = (process.env.SEVENROOMS_CLIENT_SECRET ?? "").trim();
// SevenRooms returns a token used directly in the Authorization header (no
// "Bearer" prefix by default). Override the scheme if the partner account differs.
const SR_AUTH_SCHEME = process.env.SEVENROOMS_AUTH_SCHEME ?? ""; // "" => raw token, or e.g. "Bearer"

export function sevenroomsConfigured(): boolean {
  return Boolean(SR_CLIENT_ID && SR_CLIENT_SECRET);
}
export function sevenroomsIsSandbox(): boolean {
  return IS_SANDBOX;
}

// One partner token serves every venue; cache it in-module for its lifetime
// (minus a safety margin) so we don't re-auth per call.
let cachedToken: { value: string; expiresAtMs: number } | null = null;

export async function sevenroomsLogin(): Promise<string> {
  if (!sevenroomsConfigured()) throw new Error("SevenRooms is not configured.");
  if (cachedToken && cachedToken.expiresAtMs - Date.now() > 60_000) return cachedToken.value;

  const res = await fetch(`${SR_API_BASE}${AUTH_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: SR_CLIENT_ID, client_secret: SR_CLIENT_SECRET }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { token?: string; token_expires_datetime?: string; expires_in?: number };
    token?: string;
  };
  if (!res.ok) throw new Error(`SevenRooms auth ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  const token = data.data?.token ?? data.token ?? "";
  if (!token) throw new Error("SevenRooms auth returned no token.");
  // Prefer an explicit expiry; else default to ~1h.
  const expMs = data.data?.token_expires_datetime
    ? Date.parse(data.data.token_expires_datetime)
    : Date.now() + Math.max(60_000, (data.data?.expires_in ?? 3600) * 1000);
  cachedToken = { value: token, expiresAtMs: Number.isFinite(expMs) ? expMs : Date.now() + 3600_000 };
  return token;
}

function authHeader(token: string): string {
  return SR_AUTH_SCHEME ? `${SR_AUTH_SCHEME} ${token}` : token;
}

// Authenticated GET against the SevenRooms API. Most endpoints are venue-scoped
// via a `venue_id` query param (passed by callers in `params`).
export async function sevenroomsGet<T = Record<string, unknown>>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = await sevenroomsLogin();
  const url = new URL(`${SR_API_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader(token), Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(`SevenRooms API ${res.status} on ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// Fetch a venue's display name — used to validate a Venue ID on connect and to
// map the venue to a Wingman location by name. Returns "" if unavailable.
export async function sevenroomsVenueName(venueId: string): Promise<string> {
  const r = await sevenroomsGet<{
    data?: { name?: string; venue_name?: string } | { name?: string }[];
    name?: string;
  }>(`${VENUE_PATH}/${encodeURIComponent(venueId)}`, { venue_id: venueId });
  const d = r.data;
  if (Array.isArray(d)) return (d[0]?.name ?? "").trim();
  return ((d?.name ?? (d as { venue_name?: string } | undefined)?.venue_name) ?? r.name ?? "").trim();
}
