import "server-only";

// Thin Clover REST client. Sandbox vs production is chosen by CLOVER_ENVIRONMENT.
// Credentials come from env only: CLOVER_APP_ID, CLOVER_APP_SECRET.
//
// Clover uses the v2 OAuth flow: expiring access tokens (~30 min) plus a
// refresh token that ROTATES on each use. A token grants access to one
// merchant's data — in Clover, each store is its own merchant, so a multi-store
// operator connects each store (we store one row per merchant).
//
// Base URLs and OAuth paths are env-overridable so we can adjust to Clover's
// flow without a code change. Docs: https://docs.clover.com/dev/docs/use-oauth

export const CLOVER_ENV = (process.env.CLOVER_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = CLOVER_ENV !== "production";

// OAuth/consent host and the REST API host (they differ on Clover).
export const CLOVER_OAUTH_BASE = (process.env.CLOVER_OAUTH_BASE ?? (IS_SANDBOX ? "https://sandbox.dev.clover.com" : "https://www.clover.com")).replace(/\/$/, "");
export const CLOVER_API_BASE = (process.env.CLOVER_API_BASE ?? (IS_SANDBOX ? "https://apisandbox.dev.clover.com" : "https://api.clover.com")).replace(/\/$/, "");

// v2 OAuth paths (overridable in case Clover moves them).
const AUTHORIZE_PATH = process.env.CLOVER_AUTHORIZE_PATH ?? "/oauth/v2/authorize";
const TOKEN_PATH = process.env.CLOVER_TOKEN_PATH ?? "/oauth/v2/token";
const REFRESH_PATH = process.env.CLOVER_REFRESH_PATH ?? "/oauth/v2/refresh";

const CLOVER_APP_ID = (process.env.CLOVER_APP_ID ?? "").trim();
const CLOVER_APP_SECRET = (process.env.CLOVER_APP_SECRET ?? "").trim();

export function cloverConfigured(): boolean {
  return Boolean(CLOVER_APP_ID && CLOVER_APP_SECRET);
}
export function cloverIsSandbox(): boolean {
  return IS_SANDBOX;
}

// The OAuth callback — must match what's registered on the Clover app.
export function cloverRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  return `${base}/api/integrations/clover/callback`;
}

export function cloverAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLOVER_APP_ID,
    response_type: "code",
    redirect_uri: cloverRedirectUrl(),
    state,
  });
  return `${CLOVER_OAUTH_BASE}${AUTHORIZE_PATH}?${params.toString()}`;
}

export type CloverToken = {
  access_token: string;
  refresh_token: string;
  // ISO timestamps derived from Clover's epoch-second expirations.
  access_expires_at: string | null;
  refresh_expires_at: string | null;
};

function epochSecondsToIso(v: unknown): string | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function parseToken(d: Record<string, unknown>, fallbackRefresh?: string): CloverToken {
  return {
    access_token: String(d.access_token ?? ""),
    refresh_token: String(d.refresh_token ?? fallbackRefresh ?? ""),
    access_expires_at: epochSecondsToIso(d.access_token_expiration),
    refresh_expires_at: epochSecondsToIso(d.refresh_token_expiration),
  };
}

// Exchange the authorization code for an access/refresh token pair.
export async function exchangeCloverCode(code: string): Promise<CloverToken> {
  const res = await fetch(`${CLOVER_OAUTH_BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: CLOVER_APP_ID, client_secret: CLOVER_APP_SECRET, code }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Clover token ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return parseToken(data);
}

// Refresh an expiring access token. Clover rotates the refresh token, so callers
// must persist the returned refresh_token.
export async function refreshCloverToken(refreshToken: string): Promise<CloverToken> {
  const res = await fetch(`${CLOVER_OAUTH_BASE}${REFRESH_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: CLOVER_APP_ID, refresh_token: refreshToken }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Clover refresh ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return parseToken(data, refreshToken);
}

// Authenticated GET against the Clover REST API for a connected merchant.
export async function cloverGet<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${CLOVER_API_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(`Clover API ${res.status} on ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
