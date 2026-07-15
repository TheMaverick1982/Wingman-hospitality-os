import "server-only";

// Thin Toast POS client. Sandbox vs production is chosen by TOAST_ENVIRONMENT.
// Credentials come from env only: TOAST_CLIENT_ID, TOAST_CLIENT_SECRET.
//
// Unlike Clover/Square, Toast uses MACHINE-TO-MACHINE auth: our partner app logs
// in once with client credentials to get a short-lived bearer token, then every
// data request is scoped to one restaurant via the Toast-Restaurant-External-ID
// header. A restaurant "connects" by enabling Wingman in their Toast account and
// giving us their Restaurant GUID — there's no per-user OAuth redirect. A
// multi-location operator links each restaurant GUID (one row per restaurant).
//
// Hosts and paths are env-overridable so we can adjust to Toast's API without a
// code change. Docs: https://doc.toasttab.com/

export const TOAST_ENV = (process.env.TOAST_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = TOAST_ENV !== "production";

// API host (Toast serves auth + data from the same host).
export const TOAST_API_BASE = (
  process.env.TOAST_API_BASE ?? (IS_SANDBOX ? "https://ws-sandbox-api.toasttab.com" : "https://ws-api.toasttab.com")
).replace(/\/$/, "");

// Overridable paths in case Toast moves them.
const LOGIN_PATH = process.env.TOAST_LOGIN_PATH ?? "/authentication/v1/authentication/login";
const RESTAURANT_PATH = process.env.TOAST_RESTAURANT_PATH ?? "/config/v2/restaurants"; // + /{guid}
const ORDERS_PATH = process.env.TOAST_ORDERS_PATH ?? "/orders/v2/ordersBulk";

const TOAST_CLIENT_ID = (process.env.TOAST_CLIENT_ID ?? "").trim();
const TOAST_CLIENT_SECRET = (process.env.TOAST_CLIENT_SECRET ?? "").trim();
// Toast machine clients use a fixed access type.
const TOAST_ACCESS_TYPE = process.env.TOAST_ACCESS_TYPE ?? "TOAST_MACHINE_CLIENT";

export function toastConfigured(): boolean {
  return Boolean(TOAST_CLIENT_ID && TOAST_CLIENT_SECRET);
}
export function toastIsSandbox(): boolean {
  return IS_SANDBOX;
}

// Cache the partner access token in-module for its lifetime (minus a safety
// margin). One token serves every restaurant, so this avoids logging in per call.
let cachedToken: { value: string; expiresAtMs: number } | null = null;

export async function toastLogin(): Promise<string> {
  if (!toastConfigured()) throw new Error("Toast is not configured.");
  if (cachedToken && cachedToken.expiresAtMs - Date.now() > 60_000) return cachedToken.value;

  const res = await fetch(`${TOAST_API_BASE}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ clientId: TOAST_CLIENT_ID, clientSecret: TOAST_CLIENT_SECRET, userAccessType: TOAST_ACCESS_TYPE }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: { accessToken?: string; expiresIn?: number } };
  if (!res.ok) throw new Error(`Toast login ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  const accessToken = data.token?.accessToken ?? "";
  if (!accessToken) throw new Error("Toast login returned no access token.");
  const ttlMs = Math.max(60_000, (data.token?.expiresIn ?? 3600) * 1000);
  cachedToken = { value: accessToken, expiresAtMs: Date.now() + ttlMs };
  return accessToken;
}

// Authenticated GET against the Toast API, scoped to one restaurant GUID.
export async function toastGet<T = Record<string, unknown>>(
  path: string,
  restaurantGuid: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = await toastLogin();
  const url = new URL(`${TOAST_API_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Toast-Restaurant-External-ID": restaurantGuid,
      Accept: "application/json",
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(`Toast API ${res.status} on ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// Fetch a restaurant's display name (used to confirm a GUID on connect and to
// map the restaurant to a Wingman location by name). Returns "" if unavailable.
export async function toastRestaurantName(restaurantGuid: string): Promise<string> {
  const r = await toastGet<{ general?: { name?: string }; name?: string }>(`${RESTAURANT_PATH}/${restaurantGuid}`, restaurantGuid);
  return (r.general?.name ?? r.name ?? "").trim();
}

export const TOAST_ORDERS_FULL_PATH = ORDERS_PATH;
