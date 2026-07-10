import "server-only";
import crypto from "node:crypto";

// -----------------------------------------------------------------------------
// Google Analytics Data API (GA4) client.
//
// Authenticates a service account with a self-signed JWT (RS256) using Node's
// built-in crypto — no googleapis SDK, so no extra dependency to install. Reads:
//   GA4_SERVICE_ACCOUNT_JSON  – the downloaded key file's full JSON
//   GA4_PROPERTY_ID           – the numeric GA4 property id
// -----------------------------------------------------------------------------

type ServiceAccount = { client_email: string; private_key: string };

function creds(): ServiceAccount | null {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    if (j.client_email && j.private_key) return { client_email: j.client_email, private_key: j.private_key };
  } catch {
    /* malformed */
  }
  return null;
}

export function ga4Configured(): boolean {
  return Boolean(creds() && process.env.GA4_PROPERTY_ID);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken(): Promise<string> {
  const sa = creds();
  if (!sa) throw new Error("GA4 service account isn't configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key);
  const jwt = `${signingInput}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google auth failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google auth returned no token.");
  return data.access_token;
}

type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type GaReport = { rows?: GaRow[] };

async function batchRunReports(token: string, requests: unknown[]): Promise<GaReport[]> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Analytics API error (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { reports?: GaReport[] };
  return data.reports ?? [];
}

export type AnalyticsData = {
  totals: { users: number; sessions: number; views: number; engagementRate: number };
  daily: { date: string; users: number }[];
  topPages: { path: string; views: number }[];
  channels: { channel: string; sessions: number }[];
};

const num = (r: GaRow | undefined, i = 0) => Math.round(Number(r?.metricValues?.[i]?.value ?? "0"));

// Format GA's YYYYMMDD to a short M/D label.
function shortDate(yyyymmdd: string): string {
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  return `${m}/${d}`;
}

export async function getAnalytics(days = 28): Promise<AnalyticsData> {
  const token = await accessToken();
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

  const reports = await batchRunReports(token, [
    { dateRanges, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }] },
    { dateRanges, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }], orderBys: [{ dimension: { dimensionName: "date" } }] },
    { dateRanges, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 8 },
    { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 6 },
  ]);

  const t = reports[0]?.rows?.[0];
  return {
    totals: {
      users: num(t, 0),
      sessions: num(t, 1),
      views: num(t, 2),
      engagementRate: Math.round(Number(t?.metricValues?.[3]?.value ?? "0") * 100),
    },
    daily: (reports[1]?.rows ?? []).map((r) => ({ date: shortDate(r.dimensionValues?.[0]?.value ?? ""), users: num(r) })),
    topPages: (reports[2]?.rows ?? []).map((r) => ({ path: r.dimensionValues?.[0]?.value ?? "/", views: num(r) })),
    channels: (reports[3]?.rows ?? []).map((r) => ({ channel: r.dimensionValues?.[0]?.value ?? "Unknown", sessions: num(r) })),
  };
}
