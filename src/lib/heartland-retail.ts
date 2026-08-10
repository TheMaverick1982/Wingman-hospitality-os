import "server-only";

// Thin Heartland Retail client. Heartland's OAuth app registrations are closed,
// so there's no per-user OAuth redirect: the account owner generates a USER
// ACCESS TOKEN inside Heartland Retail and pastes it into Wingman. Every request
// carries `Authorization: Bearer {token}`.
//
// Each Heartland account lives on its own subdomain, discovered once at connect
// via the system host lookup (retail.heartland.us → {host}); all data calls then
// go to https://{host}/api/... A multi-account operator connects each (one row
// per (org, account_host)). There is no sandbox — everything is production.
// Docs: https://dev.retail.heartland.us/

// Fixed lookup host used once to resolve an account's subdomain.
export const HEARTLAND_LOOKUP_BASE = (process.env.HEARTLAND_LOOKUP_BASE ?? "https://retail.heartland.us").replace(/\/$/, "");

// Token-based, no partner credentials in env — so the card always shows.
export function heartlandConfigured(): boolean {
  return true;
}

// Non-secret connection status surfaced to the browser. NEVER includes the token.
export type HeartlandConnection = {
  host: string;
  name: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncGuests: number;
  lastSyncSalesCents: number;
};

// Data shapes (defensive — only the fields we read).
export type HeartlandCustomer = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
};
export type HeartlandTicket = {
  id?: number | string;
  customer_id?: number | string;
  source_location_id?: number | string;
  status?: string; // "incomplete" | "complete" | "void"
  total?: number; // dollar amount
  completed_at?: string;
  created_at?: string;
};
export type HeartlandLocation = {
  id?: number | string;
  name?: string;
  public_id?: string;
};

// Collection responses come back as an envelope; single GETs return a bare record.
type HeartlandEnvelope<T> = { total?: number; pages?: number; results?: T[] };

// GET with Bearer auth and a 10s timeout. Returns parsed JSON or throws.
async function heartlandFetch<T>(url: string, token: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    if (!res.ok) throw new Error(`Heartland API ${res.status} on ${url}: ${JSON.stringify(data).slice(0, 200)}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// Resolve the account's subdomain host from the fixed lookup endpoint. Returns
// the host (e.g. "example.retail.heartland.us") or null if unavailable/bad token.
export async function lookupHost(token: string): Promise<string | null> {
  try {
    const data = await heartlandFetch<{ host?: string }>(`${HEARTLAND_LOOKUP_BASE}/api/system/host`, token);
    const host = (data.host ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    return host || null;
  } catch {
    return null;
  }
}

// Verify a token against a resolved host via whoami. Also returns the account
// name when Heartland provides one. valid=false on 401/insufficient token.
export async function verifyToken(token: string, host: string): Promise<{ valid: boolean; name: string }> {
  try {
    const data = await heartlandFetch<Record<string, unknown>>(`https://${host}/api/system/whoami`, token);
    const name = String(
      (data.account_name ?? data.name ?? (data.account as { name?: string } | undefined)?.name ?? "") as string,
    ).trim();
    return { valid: true, name };
  } catch {
    return { valid: false, name: "" };
  }
}

const MAX_PAGES = 50;

// Walk a paginated collection endpoint using the {total,pages,results} envelope.
// Caps at MAX_PAGES pages (logs if it hits the cap) so a huge account can't hang
// a sync. Path is like "/api/customers"; params are extra query pairs.
export async function fetchAll<T>(
  host: string,
  token: string,
  path: string,
  opts?: { params?: Record<string, string>; perPage?: number },
): Promise<T[]> {
  const perPage = opts?.perPage ?? 100;
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const url = new URL(`https://${host}${path}`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    if (opts?.params) for (const [k, v] of Object.entries(opts.params)) url.searchParams.set(k, v);
    const env = await heartlandFetch<HeartlandEnvelope<T>>(url.toString(), token);
    const results = env.results ?? [];
    out.push(...results);
    const totalPages = env.pages ?? (results.length < perPage ? page : page + 1);
    if (page >= totalPages || results.length < perPage) break;
    page++;
    if (page > MAX_PAGES) {
      console.warn(`[heartland] fetchAll capped at ${MAX_PAGES} pages for ${path} (host ${host})`);
      break;
    }
  }
  return out;
}
