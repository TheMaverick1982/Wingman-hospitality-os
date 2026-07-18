import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "./google";

// Zoom video integration via Zoom's OAuth + Meetings API. Zoom is the video
// provider for calendars that can't mint a Google Meet link (Outlook). One Zoom
// account per rep. Credentials live in Vercel as ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET;
// redirect URI: https://www.joinwingman.app/api/integrations/zoom/callback
//
// Scopes (meeting:write, user:read) are configured on the Zoom Marketplace app,
// so we don't pass a scope param on the authorize URL.

const OAUTH_BASE = "https://zoom.us/oauth";
const API = "https://api.zoom.us/v2";

export function zoomRedirectUri(): string {
  return `${siteUrl()}/api/integrations/zoom/callback`;
}
export function zoomConfigured(): boolean {
  return Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

export function zoomAuthUrl(state: string): string {
  const params = [
    "response_type=code",
    `client_id=${encodeURIComponent(process.env.ZOOM_CLIENT_ID ?? "")}`,
    `redirect_uri=${encodeURIComponent(zoomRedirectUri())}`,
    `state=${encodeURIComponent(state)}`,
  ];
  return `${OAUTH_BASE}/authorize?${params.join("&")}`;
}

export type ZoomAccountRow = {
  user_id: string;
  zoom_user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  scopes: string;
};

function basicAuthHeader(): string {
  const raw = `${process.env.ZOOM_CLIENT_ID ?? ""}:${process.env.ZOOM_CLIENT_SECRET ?? ""}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

export async function completeZoomOAuth(code: string, userId: string): Promise<{ error: string | null; email?: string }> {
  let tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string };
  try {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: zoomRedirectUri() });
    const res = await fetch(`${OAUTH_BASE}/token`, {
      method: "POST",
      headers: { authorization: basicAuthHeader(), "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; reason?: string; error?: string };
    if (!res.ok || !json.access_token) return { error: json.reason ?? json.error ?? "Zoom token exchange failed." };
    tokens = { access_token: json.access_token, refresh_token: json.refresh_token ?? "", expires_in: Number(json.expires_in ?? 0), scope: json.scope ?? "" };
  } catch (e) {
    return { error: (e as Error).message };
  }

  let zoomUserId = "";
  let email = "";
  try {
    const me = await fetch(`${API}/users/me`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const meJson = (await me.json()) as { id?: string; email?: string };
    if (!me.ok || !meJson.id) return { error: "Couldn't read your Zoom account." };
    zoomUserId = meJson.id;
    email = meJson.email ?? "";
  } catch (e) {
    return { error: (e as Error).message };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("calendar_zoom_accounts").upsert(
    {
      user_id: userId,
      zoom_user_id: zoomUserId,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      scopes: tokens.scope,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: `Couldn't save the connection: ${error.message}` };
  return { error: null, email };
}

export async function getZoomAccount(userId: string): Promise<ZoomAccountRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_zoom_accounts").select("*").eq("user_id", userId).maybeSingle();
  return (data as ZoomAccountRow | null) ?? null;
}

// Zoom rotates refresh tokens; persist the new one each refresh.
async function freshAccessToken(account: ZoomAccountRow): Promise<string> {
  const exp = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 2 * 60 * 1000) return account.access_token;
  if (!account.refresh_token) return account.access_token;
  try {
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: account.refresh_token });
    const res = await fetch(`${OAUTH_BASE}/token`, {
      method: "POST",
      headers: { authorization: basicAuthHeader(), "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!res.ok || !json.access_token) return account.access_token;
    const admin = createAdminClient();
    await admin
      .from("calendar_zoom_accounts")
      .update({
        access_token: json.access_token,
        refresh_token: json.refresh_token ?? account.refresh_token,
        token_expires_at: json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null,
      })
      .eq("user_id", account.user_id);
    return json.access_token;
  } catch {
    return account.access_token;
  }
}

// Create a scheduled Zoom meeting; returns the join URL.
export async function createZoomMeeting(
  account: ZoomAccountRow,
  opts: { topic: string; startMs: number; durationMinutes: number },
): Promise<{ joinUrl?: string; error?: string }> {
  try {
    const token = await freshAccessToken(account);
    const res = await fetch(`${API}/users/me/meetings`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        topic: opts.topic.slice(0, 200),
        type: 2, // scheduled
        start_time: `${new Date(opts.startMs).toISOString().slice(0, 19)}Z`,
        duration: Math.max(1, Math.round(opts.durationMinutes)),
        timezone: "UTC",
        settings: { join_before_host: true, waiting_room: false },
      }),
    });
    const json = (await res.json()) as { join_url?: string; message?: string };
    if (!res.ok || !json.join_url) return { error: json.message ?? `Zoom API error (${res.status})` };
    return { joinUrl: json.join_url };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
