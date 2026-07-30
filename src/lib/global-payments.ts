import "server-only";
import { createHash } from "node:crypto";
import * as heartland from "@/lib/billing/heartland";

// ---------------------------------------------------------------------------
// Thin Global Payments (GP API / Unified Commerce Platform) REST client.
//
// This is the processor behind the Wingman billing area — how customers' cards
// are stored and charged for their subscription. Sandbox vs production is chosen
// by GP_ENVIRONMENT. Credentials come from env only, never hard-coded:
//   GP_APP_ID, GP_APP_KEY                (app credentials)
//   GP_ACCOUNT_NAME    (optional)        (tokenization/transaction account)
//   GP_ENVIRONMENT     (sandbox|production, default sandbox)
//   GP_API_VERSION     (optional, default 2021-03-22)
//
// Card numbers are NEVER stored by us. We store only the GP multi-use payment
// token (PMT_…), which lives in the deny-all billing_payment_methods table and
// is only ever touched by the service-role client — never sent to the browser.
//
// Docs: https://developer.globalpayments.com/api  (access token uses a
// SHA512(nonce + app_key) secret; /payment-methods stores cards; /transactions
// charges them).
// ---------------------------------------------------------------------------

export const GP_ENV = (process.env.GP_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = GP_ENV !== "production";
export const GP_API_BASE = IS_SANDBOX ? "https://apis.sandbox.globalpay.com/ucp" : "https://apis.globalpay.com/ucp";
const GP_VERSION = process.env.GP_API_VERSION ?? "2021-03-22";

const GP_APP_ID = (process.env.GP_APP_ID ?? "").trim();
const GP_APP_KEY = (process.env.GP_APP_KEY ?? "").trim();
// GP provisions apps with named accounts (a tokenization account and a
// transaction-processing account). If your app has a single default account you
// can leave this unset and GP will pick it; otherwise name it explicitly.
const GP_ACCOUNT_NAME = (process.env.GP_ACCOUNT_NAME ?? "").trim();

// Provider switch. Wingman's live processor is Heartland/Portico (SecureSubmit,
// certified). Set BILLING_PROVIDER=heartland to route card storage + charges
// through that path; the default keeps the original GP-API path, so behavior is
// unchanged until this is intentionally flipped. Callers import the same gp*
// functions either way — only the implementation swaps underneath.
const USE_HEARTLAND = (process.env.BILLING_PROVIDER ?? "gpapi").toLowerCase() === "heartland";

export function gpConfigured(): boolean {
  if (USE_HEARTLAND) return heartland.heartlandConfigured();
  return Boolean(GP_APP_ID && GP_APP_KEY);
}
export function gpIsSandbox(): boolean {
  if (USE_HEARTLAND) return heartland.heartlandIsSandbox();
  return IS_SANDBOX;
}
// Which processor the billing UI/routes are talking to right now.
export function billingProvider(): "heartland" | "gpapi" {
  return USE_HEARTLAND ? "heartland" : "gpapi";
}
// Publishable key for the Heartland SecureSubmit browser tokenizer (empty on the
// GP-API path, which uses a server-minted client token instead).
export function heartlandBrowserPublicKey(): string {
  return heartland.heartlandPublicKey();
}
// The API version the browser hosted-fields library must be configured with —
// it has to match the version our server calls use.
export function gpApiVersion(): string {
  return GP_VERSION;
}

// GP published sandbox test cards, surfaced in the UI so an operator can prove
// the store→charge loop end-to-end before a real (live) card is ever involved.
export const GP_TEST_CARDS = [
  { brand: "Visa", number: "4263970000005262", exp: "12/25", cvv: "123" },
  { brand: "Mastercard", number: "5425230000004415", exp: "12/25", cvv: "123" },
  { brand: "Amex", number: "374101000000608", exp: "12/25", cvv: "1234" },
] as const;

// -------------------------------------------------------------------------
// Access token — POST /accesstoken. The secret is SHA512(nonce + app_key) so
// the app_key itself never travels on the wire. Tokens are short-lived; we mint
// one per operation (cheap) rather than caching.
// -------------------------------------------------------------------------
function sha512Hex(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex");
}

// One of the app's provisioned merchant accounts, as returned in the access
// token's scope. Each has a permission set — the transaction-processing account
// carries TRN_* permissions, the tokenization account carries PMT_*.
export type GpAccount = { id: string; name: string; permissions: string[] };
export type GpAuth = { token: string; accounts: GpAccount[] };

// Authenticate and return the bearer token PLUS the app's account list, so
// callers can pick the right account for a request (GP's /transactions requires
// naming the transaction-processing account explicitly).
export async function gpAuth(permissions?: string[]): Promise<GpAuth> {
  if (!gpConfigured()) throw new Error("Global Payments is not configured (set GP_APP_ID and GP_APP_KEY).");
  const nonce = new Date().toISOString();
  const body: Record<string, unknown> = {
    app_id: GP_APP_ID,
    nonce,
    secret: sha512Hex(nonce + GP_APP_KEY),
    grant_type: "client_credentials",
  };
  if (permissions && permissions.length) body.permissions = permissions;
  const res = await fetch(`${GP_API_BASE}/accesstoken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GP-Version": GP_VERSION, Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`GP accesstoken ${res.status}: ${JSON.stringify(data).slice(0, 240)} [${gpCredDiagnostic()}]`);
  const token = String(data.token ?? "");
  if (!token) throw new Error("GP accesstoken returned no token.");
  const scope = (data.scope ?? {}) as { accounts?: unknown };
  const accounts: GpAccount[] = Array.isArray(scope.accounts)
    ? (scope.accounts as Record<string, unknown>[]).map((a) => ({
        id: String(a.id ?? ""),
        name: String(a.name ?? ""),
        permissions: Array.isArray(a.permissions) ? (a.permissions as unknown[]).map(String) : [],
      }))
    : [];
  return { token, accounts };
}

export async function gpAccessToken(permissions?: string[]): Promise<string> {
  return (await gpAuth(permissions)).token;
}

// Resolve which merchant account to name on a request. An explicit
// GP_ACCOUNT_NAME env always wins; otherwise pick the account whose permissions
// start with the wanted prefix (TRN_ = transaction processing, PMT_ =
// tokenization), falling back to the first account GP returned.
function accountNameFor(accounts: GpAccount[], prefix: "TRN_" | "PMT_"): string | undefined {
  if (GP_ACCOUNT_NAME) return GP_ACCOUNT_NAME;
  const match = accounts.find((a) => a.permissions.some((p) => p.startsWith(prefix)));
  return (match ?? accounts[0])?.name || undefined;
}

// Non-secret diagnostic for debugging a rejected accesstoken. Reveals ONLY the
// masked app_id (first 6 + last 4), the credential lengths, the environment, and
// the base URL — never the app_key or the computed secret. Lets us eyeball a
// swapped/truncated/wrong-environment credential from the error message alone.
function gpCredDiagnostic(): string {
  const mask = (s: string) => (s.length <= 10 ? `len${s.length}` : `${s.slice(0, 6)}…${s.slice(-4)} len${s.length}`);
  return `env=${GP_ENV} base=${GP_API_BASE} app_id=${mask(GP_APP_ID)} app_key=${mask(GP_APP_KEY)} v=${GP_VERSION}`;
}

// A browser-scoped token (tokenize only — cannot move money) for hosted fields
// when the PCI-safe client card capture is wired for live. Returned to the
// browser is fine: it can only create single-use card tokens.
export async function gpClientTokenizeToken(): Promise<string> {
  return gpAccessToken(["PMT_POST_Create_Single"]);
}

async function gpPost<T = Record<string, unknown>>(path: string, token: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GP_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-GP-Version": GP_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(`GP ${path} ${res.status}: ${JSON.stringify(data).slice(0, 240)}`);
  return data;
}

export type StoredCard = {
  token: string; // PMT_… multi-use token
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

type GpCardResponse = {
  id?: string;
  card?: { brand?: string; masked_number_last4?: string; number_last4?: string; expiry_month?: string | number; expiry_year?: string | number };
};

function parseStoredCard(d: GpCardResponse): StoredCard {
  const c = d.card ?? {};
  const last4 = c.masked_number_last4 ?? c.number_last4 ?? null;
  const em = c.expiry_month != null ? Number(c.expiry_month) : null;
  const ey = c.expiry_year != null ? Number(c.expiry_year) : null;
  return {
    token: String(d.id ?? ""),
    brand: c.brand ?? null,
    last4: last4 ? String(last4) : null,
    expMonth: Number.isFinite(em as number) ? (em as number) : null,
    expYear: Number.isFinite(ey as number) ? (ey as number) : null,
  };
}

// Convert a browser single-use token (from hosted fields) into a stored
// multi-use payment token. This is the PCI-safe production path: the raw PAN
// never touches our servers.
export async function gpStoreCardFromSingleUseToken(singleUseToken: string, reference: string): Promise<StoredCard> {
  if (USE_HEARTLAND) return heartland.heartlandStoreCardFromSingleUseToken(singleUseToken);
  const token = await gpAccessToken();
  const body: Record<string, unknown> = {
    reference,
    usage_mode: "MULTIPLE",
    card: { id: singleUseToken },
  };
  if (GP_ACCOUNT_NAME) body.account_name = GP_ACCOUNT_NAME;
  const d = await gpPost<GpCardResponse>("/payment-methods", token, body);
  const card = parseStoredCard(d);
  if (!card.token) throw new Error("GP did not return a stored payment token.");
  return card;
}

// SANDBOX ONLY: store a card straight from its number. Used to validate the
// billing loop with GP's published test cards without needing the client
// hosted-fields library. Never enabled in production — real card capture must
// go through hosted fields so a live PAN never reaches our servers.
export async function gpStoreTestCard(input: {
  number: string;
  expMonth: number;
  expYear: number;
  cvv?: string;
  name?: string;
  reference: string;
}): Promise<StoredCard> {
  if (USE_HEARTLAND) return heartland.heartlandStoreTestCard(input);
  if (!IS_SANDBOX) throw new Error("Raw-card storage is only permitted in the sandbox.");
  const token = await gpAccessToken();
  const body: Record<string, unknown> = {
    reference: input.reference,
    usage_mode: "MULTIPLE",
    name: input.name ?? undefined,
    card: {
      number: input.number.replace(/\s+/g, ""),
      expiry_month: String(input.expMonth).padStart(2, "0"),
      expiry_year: String(input.expYear).slice(-2),
      ...(input.cvv ? { cvv: input.cvv } : {}),
    },
  };
  if (GP_ACCOUNT_NAME) body.account_name = GP_ACCOUNT_NAME;
  const d = await gpPost<GpCardResponse>("/payment-methods", token, body);
  const card = parseStoredCard(d);
  if (!card.token) throw new Error("GP did not return a stored payment token.");
  return card;
}

export type ChargeResult = {
  transactionId: string;
  status: string; // e.g. CAPTURED, DECLINED
  approved: boolean;
  brand: string | null;
  last4: string | null;
};

// Charge a stored payment token for a subscription payment. Amount is in cents.
export async function gpChargeStored(input: { token: string; amountCents: number; reference: string; currency?: string }): Promise<ChargeResult> {
  if (USE_HEARTLAND) return heartland.heartlandChargeStored(input);
  const { token, accounts } = await gpAuth();
  const body: Record<string, unknown> = {
    type: "SALE",
    channel: "CNP", // card-not-present (a stored recurring charge)
    capture_mode: "AUTO",
    amount: String(Math.round(input.amountCents)),
    currency: input.currency ?? "USD",
    country: "US",
    reference: input.reference,
    payment_method: { entry_mode: "ECOM", id: input.token },
  };
  // /transactions requires naming the transaction-processing account (40007 if
  // omitted). Resolve it from the app's accounts (env override wins).
  const acct = accountNameFor(accounts, "TRN_");
  if (acct) body.account_name = acct;
  const d = await gpPost<{ id?: string; status?: string; payment_method?: { result?: string; card?: { brand?: string; masked_number_last4?: string } } }>(
    "/transactions",
    token,
    body,
  );
  const status = String(d.status ?? d.payment_method?.result ?? "UNKNOWN").toUpperCase();
  const approved = status === "CAPTURED" || status === "PREAUTHORIZED" || status === "SUCCESS";
  return {
    transactionId: String(d.id ?? ""),
    status,
    approved,
    brand: d.payment_method?.card?.brand ?? null,
    last4: d.payment_method?.card?.masked_number_last4 ?? null,
  };
}

// Best-effort: delete a stored token when the customer removes their card.
export async function gpDeleteStoredCard(storedToken: string): Promise<void> {
  if (USE_HEARTLAND) return heartland.heartlandDeleteStoredCard();
  try {
    const token = await gpAccessToken();
    await gpPost(`/payment-methods/${encodeURIComponent(storedToken)}/delete`, token, {});
  } catch {
    /* removing the local record is what matters; GP tokens expire on their own */
  }
}
