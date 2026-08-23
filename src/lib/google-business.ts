import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Google Business Profile integration: OAuth connect + read a location's reviews
// so the AI can analyze them. Raw fetch against Google's REST APIs (no SDK),
// matching the Calendar/Square integrations here.
//
// Its own OAuth client (separate from Calendar — different audience and scope):
//   GOOGLE_BUSINESS_CLIENT_ID / GOOGLE_BUSINESS_CLIENT_SECRET in Vercel.
// Redirect URI (register it EXACTLY in the Google Cloud console):
//   https://www.joinwingman.app/api/integrations/google-business/callback
//
// Reading reviews requires the Business Profile API access approval Google grants
// on request (the ~week-long review) plus the business.manage scope.

export const GBP_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/business.manage"].join(" ");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
}
export function gbpRedirectUri(): string {
  return `${siteUrl()}/api/integrations/google-business/callback`;
}
export function gbpConfigured(): boolean {
  return Boolean(process.env.GOOGLE_BUSINESS_CLIENT_ID && process.env.GOOGLE_BUSINESS_CLIENT_SECRET);
}

export function gbpAuthUrl(state: string): string {
  const params = [
    "response_type=code",
    `client_id=${encodeURIComponent(process.env.GOOGLE_BUSINESS_CLIENT_ID ?? "")}`,
    `redirect_uri=${encodeURIComponent(gbpRedirectUri())}`,
    `scope=${encodeURIComponent(GBP_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
    "access_type=offline",
    "include_granted_scopes=true",
    "prompt=consent",
  ];
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.join("&")}`;
}

export type GbpAccountRow = {
  id: string;
  org_id: string;
  google_sub: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  scopes: string;
};

// Exchange the OAuth code for tokens, identify the Google account, and upsert the
// connection for this org. A repeat connection of the same account refreshes it.
export async function completeGbpOAuth(code: string, orgId: string, userId: string): Promise<{ error: string | null; email?: string; accountId?: string }> {
  let tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string };
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: gbpRedirectUri(),
      client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET ?? "",
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string; error?: string };
    if (!res.ok || !json.access_token) return { error: json.error_description ?? json.error ?? "Google token exchange failed." };
    tokens = { access_token: json.access_token, refresh_token: json.refresh_token ?? "", expires_in: Number(json.expires_in ?? 0), scope: json.scope ?? GBP_SCOPES };
  } catch (e) {
    return { error: (e as Error).message };
  }

  let sub = "";
  let email = "";
  try {
    const me = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const meJson = (await me.json()) as { sub?: string; email?: string };
    if (!me.ok || !meJson.sub) return { error: "Couldn't read your Google account." };
    sub = meJson.sub;
    email = meJson.email ?? "";
  } catch (e) {
    return { error: (e as Error).message };
  }

  const admin = createAdminClient();
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
  const { data: existing } = await admin.from("google_business_accounts").select("id, refresh_token").eq("org_id", orgId).eq("google_sub", sub).maybeSingle();
  const row = existing as { id: string; refresh_token: string } | null;
  if (row) {
    const update: Record<string, unknown> = { email, access_token: tokens.access_token, token_expires_at: expiresAt, scopes: tokens.scope, connected_at: new Date().toISOString() };
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    const { error } = await admin.from("google_business_accounts").update(update).eq("id", row.id);
    if (error) return { error: `Couldn't save the connection: ${error.message}` };
    return { error: null, email, accountId: row.id };
  }
  const { data: ins, error } = await admin
    .from("google_business_accounts")
    .insert({ org_id: orgId, google_sub: sub, email, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: expiresAt, scopes: tokens.scope, connected_by: userId })
    .select("id")
    .single();
  if (error || !ins) return { error: `Couldn't save the connection: ${error?.message ?? "unknown"}` };
  return { error: null, email, accountId: (ins as { id: string }).id };
}

// A valid access token for the account, refreshing (and persisting) within 2 min
// of expiry. Falls back to the stored token if refresh isn't possible.
export async function gbpFreshToken(account: GbpAccountRow): Promise<string> {
  const exp = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 2 * 60 * 1000) return account.access_token;
  if (!account.refresh_token) return account.access_token;
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET ?? "",
    });
    const res = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!res.ok || !json.access_token) return account.access_token;
    const newExpiry = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null;
    const admin = createAdminClient();
    await admin.from("google_business_accounts").update({ access_token: json.access_token, token_expires_at: newExpiry }).eq("id", account.id);
    return json.access_token;
  } catch {
    return account.access_token;
  }
}

export type GbpLocation = { accountId: string; locationId: string; title: string; address: string };

const bareId = (name: string) => name.split("/").pop() ?? name;

// Every Business Profile location the connected account can manage, across all of
// its accounts, with the bare account+location ids used by the v4 reviews path.
export async function gbpListLocations(account: GbpAccountRow): Promise<{ error: string | null; locations?: GbpLocation[] }> {
  const token = await gbpFreshToken(account);
  const out: GbpLocation[] = [];
  try {
    const accRes = await fetch(`${ACCOUNTS_URL}?pageSize=100`, { headers: { authorization: `Bearer ${token}` } });
    const accJson = (await accRes.json()) as { accounts?: { name: string }[]; error?: { message?: string } };
    if (!accRes.ok) return { error: accJson.error?.message ?? `Google accounts error (${accRes.status})` };
    for (const acc of accJson.accounts ?? []) {
      const accId = bareId(acc.name);
      const readMask = "name,title,storefrontAddress";
      let pageToken = "";
      do {
        const url = `${INFO_BASE}/${acc.name}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const locRes = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        const locJson = (await locRes.json()) as { locations?: { name: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string } }[]; nextPageToken?: string; error?: { message?: string } };
        if (!locRes.ok) return { error: locJson.error?.message ?? `Google locations error (${locRes.status})` };
        for (const l of locJson.locations ?? []) {
          const a = l.storefrontAddress;
          const address = [a?.addressLines?.join(" "), a?.locality, a?.administrativeArea].filter(Boolean).join(", ");
          out.push({ accountId: accId, locationId: bareId(l.name), title: l.title ?? "(untitled location)", address });
        }
        pageToken = locJson.nextPageToken ?? "";
      } while (pageToken);
    }
    return { error: null, locations: out };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export type GbpReview = {
  reviewId: string;
  reviewerName: string;
  stars: number;
  comment: string;
  reply: string | null;
  createTime: string | null;
  updateTime: string | null;
};

// All reviews for one mapped location (paged), plus Google's average + total.
export async function gbpListReviews(
  account: GbpAccountRow,
  googleAccountId: string,
  googleLocationId: string,
  max = 200,
): Promise<{ error: string | null; reviews?: GbpReview[]; averageRating?: number | null; totalReviewCount?: number }> {
  const token = await gbpFreshToken(account);
  const reviews: GbpReview[] = [];
  let averageRating: number | null = null;
  let totalReviewCount = 0;
  try {
    let pageToken = "";
    do {
      const url = `${REVIEWS_BASE}/accounts/${googleAccountId}/locations/${googleLocationId}/reviews?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      const json = (await res.json()) as {
        reviews?: { reviewId?: string; reviewer?: { displayName?: string }; starRating?: string; comment?: string; createTime?: string; updateTime?: string; reviewReply?: { comment?: string } }[];
        averageRating?: number;
        totalReviewCount?: number;
        nextPageToken?: string;
        error?: { message?: string };
      };
      if (!res.ok) return { error: json.error?.message ?? `Google reviews error (${res.status})` };
      averageRating = typeof json.averageRating === "number" ? json.averageRating : averageRating;
      totalReviewCount = json.totalReviewCount ?? totalReviewCount;
      for (const r of json.reviews ?? []) {
        reviews.push({
          reviewId: r.reviewId ?? "",
          reviewerName: r.reviewer?.displayName ?? "A guest",
          stars: STAR[r.starRating ?? ""] ?? 0,
          comment: (r.comment ?? "").trim(),
          reply: r.reviewReply?.comment?.trim() || null,
          createTime: r.createTime ?? null,
          updateTime: r.updateTime ?? null,
        });
      }
      pageToken = json.nextPageToken ?? "";
    } while (pageToken && reviews.length < max);
    return { error: null, reviews, averageRating, totalReviewCount };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
