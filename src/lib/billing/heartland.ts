import "server-only";
import { PorticoConfig, ServicesContainer, CreditCardData, Transaction } from "globalpayments-api";
import type { StoredCard, ChargeResult } from "@/lib/global-payments";

// ---------------------------------------------------------------------------
// Heartland / Portico (SecureSubmit) billing — the CERTIFIED card-not-present
// path. Enabled by BILLING_PROVIDER=heartland (default keeps the GP-API path).
//
// The transaction flow here mirrors exactly what passed Heartland certification:
// Account Verify + multi-use token, token Sale, Return, and Void. Credentials
// come from env only, never hard-coded:
//   HEARTLAND_SECRET_API_KEY   skapi_(cert|prod)_…  (server, deny-all)
//   HEARTLAND_PUBLIC_KEY       pkapi_(cert|prod)_…  (browser tokenization; publishable)
//   HEARTLAND_DEVELOPER_ID     (assigned; default 002914)
//   HEARTLAND_VERSION_NUMBER   (assigned; default 6391)
//   HEARTLAND_ENVIRONMENT      (sandbox|production, default sandbox)
//
// Card numbers never touch our servers: the browser tokenizes with the PUBLIC
// key (SecureSubmit) into a single-use token; the server converts that into a
// stored MULTI-use token via Account Verify, and charges the stored token
// thereafter. The multi-use token lives in the deny-all billing_payment_methods
// table, same as the GP-API path.
// ---------------------------------------------------------------------------

const ENV = (process.env.HEARTLAND_ENVIRONMENT ?? "sandbox").toLowerCase();
const IS_SANDBOX = ENV !== "production";
const SECRET = (process.env.HEARTLAND_SECRET_API_KEY ?? "").trim();
const PUBLIC_KEY = (process.env.HEARTLAND_PUBLIC_KEY ?? "").trim();
const DEVELOPER_ID = (process.env.HEARTLAND_DEVELOPER_ID ?? "002914").trim();
const VERSION_NUMBER = (process.env.HEARTLAND_VERSION_NUMBER ?? "6391").trim();
const SERVICE_URL = IS_SANDBOX ? "https://cert.api2.heartlandportico.com" : "https://api2.heartlandportico.com";

let configured = false;
function configure(): void {
  if (configured) return;
  if (!SECRET) throw new Error("Heartland is not configured (set HEARTLAND_SECRET_API_KEY).");
  const config = new PorticoConfig();
  config.secretApiKey = SECRET;
  config.developerId = DEVELOPER_ID;
  config.versionNumber = VERSION_NUMBER;
  config.serviceUrl = SERVICE_URL;
  ServicesContainer.configureService(config);
  configured = true;
}

export function heartlandConfigured(): boolean {
  return Boolean(SECRET);
}
export function heartlandIsSandbox(): boolean {
  return IS_SANDBOX;
}
// The publishable key the browser SecureSubmit library uses to tokenize a card.
// Safe to expose to the owner's browser — it can only create single-use tokens.
export function heartlandPublicKey(): string {
  return PUBLIC_KEY;
}

// Portico's execute() resolves a Transaction; we read only these fields.
type PorticoResponse = {
  token?: string;
  transactionId?: string;
  responseCode?: string;
  responseMessage?: string;
  cardType?: string;
  cardLast4?: string | number;
};
async function exec(builder: { execute: () => Promise<unknown> }): Promise<PorticoResponse> {
  return (await builder.execute()) as unknown as PorticoResponse;
}
const APPROVED = "00";

// Convert a browser single-use token into a stored multi-use token (Account
// Verify with RequestMultiUseToken). The raw PAN never reaches our servers.
export async function heartlandStoreCardFromSingleUseToken(singleUseToken: string): Promise<StoredCard> {
  configure();
  const card = new CreditCardData();
  card.token = singleUseToken;
  const r = await exec(card.verify().withRequestMultiUseToken(true).withAllowDuplicates(true));
  if (!r.token) throw new Error("Heartland did not return a multi-use token.");
  return { token: String(r.token), brand: r.cardType ?? null, last4: r.cardLast4 != null ? String(r.cardLast4) : null, expMonth: null, expYear: null };
}

// SANDBOX ONLY: verify a raw test card to get a multi-use token, to validate the
// store→charge loop without the browser library (mirrors certification #1–4).
export async function heartlandStoreTestCard(input: { number: string; expMonth: number; expYear: number; cvv?: string; name?: string; reference: string }): Promise<StoredCard> {
  if (!IS_SANDBOX) throw new Error("Raw-card storage is only permitted in the sandbox.");
  configure();
  const card = new CreditCardData();
  card.number = input.number.replace(/\s+/g, "");
  card.expMonth = String(input.expMonth);
  card.expYear = String(input.expYear).length === 2 ? `20${input.expYear}` : String(input.expYear);
  if (input.cvv) card.cvn = input.cvv;
  if (input.name) card.cardHolderName = input.name;
  const r = await exec(card.verify().withRequestMultiUseToken(true).withAllowDuplicates(true));
  if (!r.token) throw new Error("Heartland did not return a multi-use token.");
  const last4 = r.cardLast4 != null ? String(r.cardLast4) : input.number.replace(/\s+/g, "").slice(-4);
  return { token: String(r.token), brand: r.cardType ?? null, last4, expMonth: input.expMonth, expYear: input.expYear };
}

// Charge a stored multi-use token for a subscription payment. Amount in cents.
export async function heartlandChargeStored(input: { token: string; amountCents: number; reference: string; currency?: string }): Promise<ChargeResult> {
  configure();
  const card = new CreditCardData();
  card.token = input.token;
  const amount = (Math.round(input.amountCents) / 100).toFixed(2);
  const r = await exec(card.charge(amount).withCurrency(input.currency ?? "USD").withAllowDuplicates(true));
  const approved = r.responseCode === APPROVED;
  return {
    transactionId: String(r.transactionId ?? ""),
    status: approved ? "CAPTURED" : `DECLINED_${r.responseCode ?? "??"}`,
    approved,
    brand: r.cardType ?? null,
    last4: r.cardLast4 != null ? String(r.cardLast4) : null,
  };
}

// Refund/return money to a stored token (standalone Credit Return). Cents.
export async function heartlandRefundStored(input: { token: string; amountCents: number; currency?: string }): Promise<ChargeResult> {
  configure();
  const card = new CreditCardData();
  card.token = input.token;
  const amount = (Math.round(input.amountCents) / 100).toFixed(2);
  const r = await exec(card.refund(amount).withCurrency(input.currency ?? "USD").withAllowDuplicates(true));
  const approved = r.responseCode === APPROVED;
  return {
    transactionId: String(r.transactionId ?? ""),
    status: approved ? "REFUNDED" : `DECLINED_${r.responseCode ?? "??"}`,
    approved,
    brand: r.cardType ?? null,
    last4: r.cardLast4 != null ? String(r.cardLast4) : null,
  };
}

// Void / reverse a not-yet-settled transaction by its id.
export async function heartlandVoid(transactionId: string): Promise<{ approved: boolean; transactionId: string }> {
  configure();
  const r = await exec(Transaction.fromId(transactionId).void());
  return { approved: r.responseCode === APPROVED, transactionId: String(r.transactionId ?? transactionId) };
}

// Portico multi-use tokens don't require explicit deletion — they're only usable
// by our merchant and age out. Removing the local record is what matters (no-op).
export async function heartlandDeleteStoredCard(): Promise<void> {
  return;
}
