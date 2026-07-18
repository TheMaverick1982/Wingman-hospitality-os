import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusyInterval, CreatedEvent } from "./google";
import { siteUrl } from "./google";

// Outlook / Microsoft 365 calendar via Microsoft Graph. Raw fetch, mirroring the
// Google integration. OAuth client lives in Vercel as
// MICROSOFT_CALENDAR_CLIENT_ID / MICROSOFT_CALENDAR_CLIENT_SECRET; redirect URI:
//   https://www.joinwingman.app/api/integrations/microsoft/callback
//
// Video: an Outlook event can't carry a Google Meet link, and we're not using
// Teams — so Outlook-hosted meetings are created without an auto video link until
// the Zoom integration lands (Zoom then supplies the link for Outlook hosts).

// `common` authority accepts both work/school and personal Microsoft accounts.
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_ACCOUNTS = 2;

// offline_access → refresh token; Calendars.ReadWrite → read free/busy + create
// events; User.Read + openid/email/profile → identify the account; Mail.Send +
// Mail.Read → send/receive conversation email from the rep's own mailbox.
export const MS_SCOPES = ["offline_access", "openid", "email", "profile", "User.Read", "Calendars.ReadWrite", "Mail.Send", "Mail.Read"].join(" ");

// Whether an account's granted scopes include mailbox send / read (an account
// connected before mail scopes were added must reconnect to grant them).
export function hasMailSend(scopes: string): boolean {
  return /mail\.send/i.test(scopes || "");
}
export function hasMailRead(scopes: string): boolean {
  return /mail\.read/i.test(scopes || "");
}

export function microsoftRedirectUri(): string {
  return `${siteUrl()}/api/integrations/microsoft/callback`;
}
export function microsoftCalendarConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CALENDAR_CLIENT_ID && process.env.MICROSOFT_CALENDAR_CLIENT_SECRET);
}

export function microsoftAuthUrl(state: string): string {
  const params = [
    "response_type=code",
    "response_mode=query",
    `client_id=${encodeURIComponent(process.env.MICROSOFT_CALENDAR_CLIENT_ID ?? "")}`,
    `redirect_uri=${encodeURIComponent(microsoftRedirectUri())}`,
    `scope=${encodeURIComponent(MS_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
    "prompt=select_account",
  ];
  return `${AUTHORITY}/authorize?${params.join("&")}`;
}

export type MicrosoftAccountRow = {
  id: string;
  user_id: string;
  ms_sub: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  scopes: string;
  calendar_id: string;
  connected_at: string;
};

export async function completeMicrosoftOAuth(code: string, userId: string): Promise<{ error: string | null; email?: string }> {
  let tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string };
  try {
    const body = new URLSearchParams({
      client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: microsoftRedirectUri(),
      scope: MS_SCOPES,
    });
    const res = await fetch(`${AUTHORITY}/token`, {
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
    if (!res.ok || !json.access_token) return { error: json.error_description ?? json.error ?? "Microsoft token exchange failed." };
    tokens = {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? "",
      expires_in: Number(json.expires_in ?? 0),
      scope: json.scope ?? MS_SCOPES,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Identity via Graph /me.
  let sub = "";
  let email = "";
  try {
    const me = await fetch(`${GRAPH}/me`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const meJson = (await me.json()) as { id?: string; mail?: string; userPrincipalName?: string };
    if (!me.ok || !meJson.id) return { error: "Couldn't read your Microsoft account." };
    sub = meJson.id;
    email = meJson.mail || meJson.userPrincipalName || "";
  } catch (e) {
    return { error: (e as Error).message };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("calendar_microsoft_accounts").select("id, ms_sub").eq("user_id", userId);
  const rows = (existing ?? []) as { id: string; ms_sub: string }[];
  const already = rows.find((r) => r.ms_sub === sub);
  if (!already && rows.length >= MAX_ACCOUNTS) {
    return { error: `You can connect up to ${MAX_ACCOUNTS} Outlook calendars. Disconnect one first.` };
  }

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
  if (already) {
    const update: Record<string, unknown> = {
      email,
      access_token: tokens.access_token,
      token_expires_at: expiresAt,
      scopes: tokens.scope,
      connected_at: new Date().toISOString(),
    };
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    const { error } = await admin.from("calendar_microsoft_accounts").update(update).eq("id", already.id);
    if (error) return { error: `Couldn't save the connection: ${error.message}` };
  } else {
    const { error } = await admin.from("calendar_microsoft_accounts").insert({
      user_id: userId,
      ms_sub: sub,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      scopes: tokens.scope,
      calendar_id: "",
    });
    if (error) return { error: `Couldn't save the connection: ${error.message}` };
  }
  return { error: null, email };
}

// Microsoft rotates refresh tokens, so persist the new one when present.
async function freshAccessToken(account: MicrosoftAccountRow): Promise<string> {
  const exp = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 2 * 60 * 1000) return account.access_token;
  if (!account.refresh_token) return account.access_token;
  try {
    // Refresh with the scopes THIS account actually granted — requesting more than
    // was consented (e.g. the new Mail scopes on an older calendar-only account)
    // makes Azure reject the refresh and would break the calendar. Reconnecting
    // upgrades account.scopes to include mail.
    const body = new URLSearchParams({
      client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope: account.scopes || MS_SCOPES,
    });
    const res = await fetch(`${AUTHORITY}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!res.ok || !json.access_token) return account.access_token;
    const newExpiry = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null;
    const admin = createAdminClient();
    const update: Record<string, unknown> = { access_token: json.access_token, token_expires_at: newExpiry };
    if (json.refresh_token) update.refresh_token = json.refresh_token;
    await admin.from("calendar_microsoft_accounts").update(update).eq("id", account.id);
    return json.access_token;
  } catch {
    return account.access_token;
  }
}

function parseGraphDateTime(dt: { dateTime?: string; timeZone?: string } | undefined): number {
  const s = dt?.dateTime ?? "";
  if (!s) return NaN;
  // We request UTC, so Graph returns UTC datetimes without an offset — append Z.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  return new Date(iso).getTime();
}

// Free/busy across the account's default calendar via Graph getSchedule.
export async function microsoftFreeBusy(accounts: MicrosoftAccountRow[], timeMinMs: number, timeMaxMs: number): Promise<BusyInterval[]> {
  const intervals: BusyInterval[] = [];
  for (const account of accounts) {
    if (!account.email) continue;
    try {
      const token = await freshAccessToken(account);
      const res = await fetch(`${GRAPH}/me/calendar/getSchedule`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          schedules: [account.email],
          startTime: { dateTime: new Date(timeMinMs).toISOString().slice(0, 19), timeZone: "UTC" },
          endTime: { dateTime: new Date(timeMaxMs).toISOString().slice(0, 19), timeZone: "UTC" },
          availabilityViewInterval: 30,
        }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        value?: { scheduleItems?: { status?: string; start?: { dateTime?: string; timeZone?: string }; end?: { dateTime?: string; timeZone?: string } }[] }[];
      };
      for (const sched of json.value ?? []) {
        for (const item of sched.scheduleItems ?? []) {
          if (item.status === "free") continue;
          const start = parseGraphDateTime(item.start);
          const end = parseGraphDateTime(item.end);
          if (Number.isFinite(start) && Number.isFinite(end)) intervals.push({ start, end });
        }
      }
    } catch {
      // skip this calendar
    }
  }
  return intervals;
}

// Create the event on the account's default calendar. No online meeting yet
// (Zoom will supply the video link for Outlook hosts).
export async function createMicrosoftEvent(
  account: MicrosoftAccountRow,
  opts: {
    summary: string;
    description: string;
    startISO: string; // unused for Graph (we send UTC below) — kept for a common signature
    endISO: string;
    startMs: number;
    endMs: number;
    timeZone: string;
    inviteeEmail: string;
    inviteeName: string;
    videoLink?: string;
  },
): Promise<{ event?: CreatedEvent; error?: string }> {
  try {
    const token = await freshAccessToken(account);
    const content = opts.videoLink ? `${opts.description}\n\nJoin Zoom Meeting: ${opts.videoLink}` : opts.description;
    const body: Record<string, unknown> = {
      subject: opts.summary,
      body: { contentType: "text", content },
      start: { dateTime: new Date(opts.startMs).toISOString().slice(0, 19), timeZone: "UTC" },
      end: { dateTime: new Date(opts.endMs).toISOString().slice(0, 19), timeZone: "UTC" },
      attendees: [{ emailAddress: { address: opts.inviteeEmail, name: opts.inviteeName || undefined }, type: "required" }],
    };
    if (opts.videoLink) body.location = { displayName: "Zoom Meeting" };
    const res = await fetch(`${GRAPH}/me/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { id?: string; iCalUId?: string; webLink?: string; error?: { message?: string } };
    if (!res.ok || !json.id) return { error: json.error?.message ?? `Microsoft Graph error (${res.status})` };
    return { event: { eventId: json.id, iCalUID: json.iCalUId ?? "", meetLink: opts.videoLink ?? "", htmlLink: json.webLink ?? "" } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Send an email from the account's own mailbox via Graph /me/sendMail. The
// message shows up in the rep's Sent folder and comes from their real address.
export async function sendMailViaGraph(
  account: MicrosoftAccountRow,
  opts: { toEmail: string; toName?: string; subject: string; html: string; replyTo?: string; fromName?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await freshAccessToken(account);
    const message: Record<string, unknown> = {
      subject: opts.subject,
      body: { contentType: "HTML", content: opts.html },
      toRecipients: [{ emailAddress: { address: opts.toEmail, name: opts.toName || undefined } }],
    };
    // Override the display name (still from the rep's real address).
    if (opts.fromName && account.email) message.from = { emailAddress: { name: opts.fromName, address: account.email } };
    if (opts.replyTo) message.replyTo = [{ emailAddress: { address: opts.replyTo } }];
    const res = await fetch(`${GRAPH}/me/sendMail`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j.error?.message ?? `Graph sendMail error (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Recent inbox messages received after `sinceIso` (first run: last 24h), oldest
// first, for the inbound conversation sync.
export type InboundMail = { id: string; fromEmail: string; fromName: string; subject: string; preview: string; receivedAt: string };
export async function listRecentMail(account: MicrosoftAccountRow, sinceIso: string | null): Promise<InboundMail[]> {
  try {
    const token = await freshAccessToken(account);
    const since = sinceIso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const params =
      `$filter=${encodeURIComponent(`receivedDateTime gt ${since}`)}` +
      `&$orderby=${encodeURIComponent("receivedDateTime asc")}` +
      `&$select=id,subject,bodyPreview,from,receivedDateTime&$top=25`;
    const res = await fetch(`${GRAPH}/me/mailFolders/inbox/messages?${params}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      value?: { id?: string; subject?: string; bodyPreview?: string; receivedDateTime?: string; from?: { emailAddress?: { address?: string; name?: string } } }[];
    };
    return (json.value ?? [])
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id!,
        fromEmail: (m.from?.emailAddress?.address ?? "").toLowerCase(),
        fromName: m.from?.emailAddress?.name ?? "",
        subject: m.subject ?? "",
        preview: m.bodyPreview ?? "",
        receivedAt: m.receivedDateTime ?? "",
      }));
  } catch {
    return [];
  }
}

export async function deleteMicrosoftEvent(account: MicrosoftAccountRow, eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    const token = await freshAccessToken(account);
    await fetch(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore
  }
}
