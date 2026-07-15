import "server-only";

// Thin Square REST client. Sandbox vs production is chosen by SQUARE_ENVIRONMENT.
// Credentials come from env (never hard-coded): SQUARE_APPLICATION_ID,
// SQUARE_APPLICATION_SECRET, and optionally SQUARE_ACCESS_TOKEN (a sandbox
// test-merchant token for smoke-testing before OAuth is wired).

export const SQUARE_ENV = (process.env.SQUARE_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = SQUARE_ENV !== "production";
export const SQUARE_API_BASE = IS_SANDBOX ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
// Square requires a dated version header; override via env when Square bumps it.
const SQUARE_VERSION = process.env.SQUARE_VERSION ?? "2024-12-18";
// Read-only scopes for the data we sync (customers → guests, payments → sales).
export const SQUARE_SCOPES = "CUSTOMERS_READ ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ";

export const SQUARE_APP_ID = process.env.SQUARE_APPLICATION_ID ?? "";
const SQUARE_APP_SECRET = process.env.SQUARE_APPLICATION_SECRET ?? "";

// The OAuth callback must exactly match what's registered in the Square app.
export function squareRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  return process.env.SQUARE_REDIRECT_URL ?? `${base}/api/integrations/square/callback`;
}

export function squareConfigured(): boolean {
  return Boolean(SQUARE_APP_ID && SQUARE_APP_SECRET);
}

export function squareAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SQUARE_APP_ID,
    scope: SQUARE_SCOPES,
    session: "false",
    state,
    redirect_uri: squareRedirectUrl(),
  });
  return `${SQUARE_API_BASE}/oauth2/authorize?${params.toString()}`;
}

export type SquareToken = {
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  merchant_id: string;
};

async function oauthPost(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SQUARE_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Square OAuth ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

export async function exchangeCodeForToken(code: string): Promise<SquareToken> {
  const d = await oauthPost({
    client_id: SQUARE_APP_ID,
    client_secret: SQUARE_APP_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: squareRedirectUrl(),
  });
  return {
    access_token: String(d.access_token ?? ""),
    refresh_token: String(d.refresh_token ?? ""),
    expires_at: (d.expires_at as string) ?? null,
    merchant_id: String(d.merchant_id ?? ""),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<SquareToken> {
  const d = await oauthPost({
    client_id: SQUARE_APP_ID,
    client_secret: SQUARE_APP_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return {
    access_token: String(d.access_token ?? ""),
    refresh_token: String(d.refresh_token ?? refreshToken),
    expires_at: (d.expires_at as string) ?? null,
    merchant_id: String(d.merchant_id ?? ""),
  };
}

export async function revokeToken(accessToken: string): Promise<void> {
  await fetch(`${SQUARE_API_BASE}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      Authorization: `Client ${SQUARE_APP_SECRET}`,
    },
    body: JSON.stringify({ client_id: SQUARE_APP_ID, access_token: accessToken }),
  }).catch(() => {});
}

// Authenticated GET against the Square API for a connected merchant.
export async function squareGet<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${SQUARE_API_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw new Error(`Square API ${res.status} on ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
