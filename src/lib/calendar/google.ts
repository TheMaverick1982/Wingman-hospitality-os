import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Google Calendar integration (Phase 1): OAuth connect, free/busy, and event
// creation with a Google Meet link. Raw fetch against Google's REST APIs (no
// SDK), matching the LinkedIn/Meta/Square integrations in this codebase.
//
// The OAuth client lives in Vercel as GOOGLE_CALENDAR_CLIENT_ID /
// GOOGLE_CALENDAR_CLIENT_SECRET. The redirect URI is fixed and must exactly
// match what's registered in the Google Cloud console:
//   https://www.joinwingman.app/api/integrations/google/callback

// calendar.events → create the meeting; calendar.readonly → read free/busy across
// the user's calendars; openid email profile → identify the connected account.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  // Send conversation email from the rep's Gmail (send only — reading the inbox
  // is a Google "restricted" scope we deliberately avoid; Gmail replies are
  // captured via reply-routing instead).
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export function hasGmailSend(scopes: string): boolean {
  return /gmail\.send/i.test(scopes || "");
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";
const MAX_ACCOUNTS = 2;

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
}
export function googleRedirectUri(): string {
  return `${siteUrl()}/api/integrations/google/callback`;
}
export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function googleAuthUrl(state: string): string {
  // Build manually with encodeURIComponent so the space-separated scopes encode
  // predictably. access_type=offline + prompt=consent are what make Google return
  // a refresh token (and re-issue one on reconnect).
  const params = [
    "response_type=code",
    `client_id=${encodeURIComponent(process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "")}`,
    `redirect_uri=${encodeURIComponent(googleRedirectUri())}`,
    `scope=${encodeURIComponent(GOOGLE_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
    "access_type=offline",
    "include_granted_scopes=true",
    "prompt=consent",
  ];
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.join("&")}`;
}

export type GoogleAccountRow = {
  id: string;
  user_id: string;
  google_sub: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  scopes: string;
  calendar_id: string;
  connected_at: string;
};

// Exchange the OAuth code for tokens, read the account identity, and store it —
// enforcing the two-account cap. A repeat of an already-connected account just
// refreshes its tokens (a "reconnect").
export async function completeGoogleOAuth(
  code: string,
  userId: string,
): Promise<{ error: string | null; email?: string }> {
  let tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string };
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: googleRedirectUri(),
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
      error?: string;
    };
    if (!res.ok || !json.access_token) {
      return { error: json.error_description ?? json.error ?? "Google token exchange failed." };
    }
    tokens = {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? "",
      expires_in: Number(json.expires_in ?? 0),
      scope: json.scope ?? GOOGLE_SCOPES,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Identify the Google account (sub is the stable id; email is what we show).
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
  const { data: existing } = await admin
    .from("calendar_google_accounts")
    .select("id, google_sub")
    .eq("user_id", userId);
  const rows = (existing ?? []) as { id: string; google_sub: string }[];
  const already = rows.find((r) => r.google_sub === sub);
  if (!already && rows.length >= MAX_ACCOUNTS) {
    return { error: `You can connect up to ${MAX_ACCOUNTS} Google calendars. Disconnect one first.` };
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  if (already) {
    // Reconnect: refresh tokens. Google may omit refresh_token on re-consent —
    // keep the stored one if so.
    const update: Record<string, unknown> = {
      email,
      access_token: tokens.access_token,
      token_expires_at: expiresAt,
      scopes: tokens.scope,
      connected_at: new Date().toISOString(),
    };
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    const { error } = await admin.from("calendar_google_accounts").update(update).eq("id", already.id);
    if (error) return { error: `Couldn't save the connection: ${error.message}` };
  } else {
    const { error } = await admin.from("calendar_google_accounts").insert({
      user_id: userId,
      google_sub: sub,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      scopes: tokens.scope,
      calendar_id: "primary",
    });
    if (error) return { error: `Couldn't save the connection: ${error.message}` };
  }
  return { error: null, email };
}

// Return a valid access token for the account, refreshing (and persisting) it if
// it's within 2 minutes of expiry. Falls back to the stored token if there's no
// refresh token or the refresh fails.
export async function freshAccessToken(account: GoogleAccountRow): Promise<string> {
  const exp = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 2 * 60 * 1000) return account.access_token;
  if (!account.refresh_token) return account.access_token;

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!res.ok || !json.access_token) return account.access_token;
    const newExpiry = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null;
    const admin = createAdminClient();
    await admin
      .from("calendar_google_accounts")
      .update({ access_token: json.access_token, token_expires_at: newExpiry })
      .eq("id", account.id);
    return json.access_token;
  } catch {
    return account.access_token;
  }
}

export type BusyInterval = { start: number; end: number }; // epoch ms

// Merge free/busy across every calendar the user has connected. Any account that
// errors is skipped (its busy times just won't be subtracted) rather than failing
// the whole availability computation.
export async function mergedFreeBusy(
  accounts: GoogleAccountRow[],
  timeMinMs: number,
  timeMaxMs: number,
): Promise<BusyInterval[]> {
  const intervals: BusyInterval[] = [];
  for (const account of accounts) {
    try {
      const token = await freshAccessToken(account);
      const res = await fetch(`${CAL_BASE}/freeBusy`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          timeMin: new Date(timeMinMs).toISOString(),
          timeMax: new Date(timeMaxMs).toISOString(),
          items: [{ id: account.calendar_id || "primary" }],
        }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
      };
      for (const cal of Object.values(json.calendars ?? {})) {
        for (const b of cal.busy ?? []) {
          intervals.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() });
        }
      }
    } catch {
      // skip this calendar
    }
  }
  return intervals;
}

// Cancel a booking's Google event (notifying the attendee). Best-effort — a
// failure here shouldn't block marking the booking cancelled in our own records.
// RFC 2047-encode a header value when it contains non-ASCII.
function encodeHeader(v: string): string {
  return /^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;
}

// Send an HTML email from the account's Gmail via the Gmail API (send scope). The
// message appears in the rep's Sent mail and comes from their real address.
export async function sendMailViaGmail(
  account: GoogleAccountRow,
  opts: { toEmail: string; toName?: string; subject: string; html: string; replyTo?: string; fromName?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await freshAccessToken(account);
    const to = opts.toName ? `${encodeHeader(opts.toName)} <${opts.toEmail}>` : opts.toEmail;
    const headers = [
      // Override the display name (still from the rep's real Gmail address).
      ...(opts.fromName && account.email ? [`From: ${encodeHeader(opts.fromName)} <${account.email}>`] : []),
      `To: ${to}`,
      `Subject: ${encodeHeader(opts.subject)}`,
      ...(opts.replyTo ? [`Reply-To: ${opts.replyTo}`] : []),
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
    ];
    const raw = `${headers.join("\r\n")}\r\n\r\n${opts.html}`;
    const encoded = Buffer.from(raw, "utf-8").toString("base64url");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: encoded }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j.error?.message ?? `Gmail send error (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteBookingEvent(account: GoogleAccountRow, eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    const token = await freshAccessToken(account);
    await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(account.calendar_id || "primary")}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
    );
  } catch {
    // ignore
  }
}

export type CreatedEvent = {
  eventId: string;
  iCalUID: string;
  meetLink: string;
  htmlLink: string;
};

// Create the meeting on the host's calendar with a Google Meet link and the
// invitee as an attendee. sendUpdates=all lets Google email the native calendar
// invite too; we additionally send our own branded confirmation with an .ics.
export async function createBookingEvent(
  account: GoogleAccountRow,
  opts: {
    summary: string;
    description: string;
    startISO: string; // RFC3339 with offset
    endISO: string;
    timeZone: string;
    inviteeEmail: string;
    inviteeName: string;
    // When set, use this external link (e.g. Zoom) instead of creating a Google
    // Meet — the event just embeds it in the description.
    videoLink?: string;
  },
): Promise<{ event?: CreatedEvent; error?: string }> {
  try {
    const token = await freshAccessToken(account);
    const requestId = `wm-${account.id}-${Date.now()}`;
    const useMeet = !opts.videoLink;
    const description = opts.videoLink ? `${opts.description}\n\nJoin Zoom Meeting: ${opts.videoLink}` : opts.description;
    const body: Record<string, unknown> = {
      summary: opts.summary,
      description,
      start: { dateTime: opts.startISO, timeZone: opts.timeZone },
      end: { dateTime: opts.endISO, timeZone: opts.timeZone },
      attendees: [{ email: opts.inviteeEmail, displayName: opts.inviteeName || undefined }],
    };
    if (useMeet) {
      body.conferenceData = { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } };
    }
    const res = await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(account.calendar_id || "primary")}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json()) as {
      id?: string;
      iCalUID?: string;
      hangoutLink?: string;
      htmlLink?: string;
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
      error?: { message?: string };
    };
    if (!res.ok || !json.id) return { error: json.error?.message ?? `Google Calendar error (${res.status})` };
    const meet = opts.videoLink
      ? opts.videoLink
      : json.hangoutLink ?? json.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? "";
    return { event: { eventId: json.id, iCalUID: json.iCalUID ?? "", meetLink: meet, htmlLink: json.htmlLink ?? "" } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
