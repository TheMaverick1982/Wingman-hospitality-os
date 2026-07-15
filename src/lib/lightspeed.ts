import "server-only";

// Thin Lightspeed client. Sandbox vs production is chosen by
// LIGHTSPEED_ENVIRONMENT. Credentials come from env only:
// LIGHTSPEED_CLIENT_ID, LIGHTSPEED_CLIENT_SECRET.
//
// Lightspeed uses OAuth 2.0 (authorization-code) with expiring access tokens and
// a refresh token. A token grants access to one business/account. Base URLs and
// OAuth paths are env-overridable so we can adjust to Lightspeed's flow (Retail
// vs Restaurant) without a code change. Docs: https://developers.lightspeedhq.com/

export const LIGHTSPEED_ENV = (process.env.LIGHTSPEED_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = LIGHTSPEED_ENV !== "production";

// OAuth/consent host and the REST API host (overridable per Lightspeed product).
export const LIGHTSPEED_OAUTH_BASE = (process.env.LIGHTSPEED_OAUTH_BASE ?? "https://cloud.lightspeedapp.com").replace(/\/$/, "");
export const LIGHTSPEED_API_BASE = (process.env.LIGHTSPEED_API_BASE ?? "https://api.lightspeedapp.com").replace(/\/$/, "");

const AUTHORIZE_PATH = process.env.LIGHTSPEED_AUTHORIZE_PATH ?? "/auth/oauth/authorize";
const TOKEN_PATH = process.env.LIGHTSPEED_TOKEN_PATH ?? "/auth/oauth/token";
// Scopes requested at consent (space-separated), overridable.
const SCOPES = process.env.LIGHTSPEED_SCOPES ?? "employee:all";

const CLIENT_ID = (process.env.LIGHTSPEED_CLIENT_ID ?? "").trim();
const CLIENT_SECRET = (process.env.LIGHTSPEED_CLIENT_SECRET ?? "").trim();

export function lightspeedConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}
export function lightspeedIsSandbox(): boolean {
  return IS_SANDBOX;
}

export function lightspeedRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  return `${base}/api/integrations/lightspeed/callback`;
}

export function lightspeedAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: lightspeedRedirectUrl(),
    state,
  });
  return `${LIGHTSPEED_OAUTH_BASE}${AUTHORIZE_PATH}?${params.toString()}`;
}

export type LightspeedToken = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string | null;
};

function secondsToIso(v: unknown): string | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 1000).toISOString();
}

function parseToken(d: Record<string, unknown>, fallbackRefresh?: string): LightspeedToken {
  return {
    access_token: String(d.access_token ?? ""),
    refresh_token: String(d.refresh_token ?? fallbackRefresh ?? ""),
    access_expires_at: secondsToIso(d.expires_in),
  };
}

// Exchange the authorization code for an access/refresh token pair.
export async function exchangeLightspeedCode(code: string): Promise<LightspeedToken> {
  const res = await fetch(`${LIGHTSPEED_OAUTH_BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: lightspeedRedirectUrl(),
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Lightspeed token ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return parseToken(data);
}

// Refresh an expiring access token.
export async function refreshLightspeedToken(refreshToken: string): Promise<LightspeedToken> {
  const res = await fetch(`${LIGHTSPEED_OAUTH_BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Lightspeed refresh ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return parseToken(data, refreshToken);
}

// Authenticated GET against the Lightspeed REST API for a connected account.
export async function lightspeedGet<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${LIGHTSPEED_API_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(`Lightspeed API ${res.status} on ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
