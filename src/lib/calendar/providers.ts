import "server-only";
import {
  mergedFreeBusy,
  createBookingEvent,
  deleteBookingEvent,
  type BusyInterval,
  type CreatedEvent,
  type GoogleAccountRow,
} from "./google";
import {
  microsoftFreeBusy,
  createMicrosoftEvent,
  deleteMicrosoftEvent,
  type MicrosoftAccountRow,
} from "./microsoft";
import { listGoogleAccounts, listMicrosoftAccounts, type PublicAccountInfo } from "./settings";

export type CalendarProvider = "google" | "microsoft";

// A connected account of either provider, discriminated by `provider`.
export type CalendarAccount =
  | ({ provider: "google" } & GoogleAccountRow)
  | ({ provider: "microsoft" } & MicrosoftAccountRow);

// All of a user's connected calendars, Google first (so a Google host is
// preferred when creating events → we get a Meet link when available).
export async function listCalendarAccounts(userId: string): Promise<CalendarAccount[]> {
  const [google, microsoft] = await Promise.all([listGoogleAccounts(userId), listMicrosoftAccounts(userId)]);
  return [
    ...google.map((a) => ({ provider: "google" as const, ...a })),
    ...microsoft.map((a) => ({ provider: "microsoft" as const, ...a })),
  ];
}

// Non-secret account info for the UI (never a token).
export async function listCalendarAccountsPublic(userId: string): Promise<PublicAccountInfo[]> {
  const accounts = await listCalendarAccounts(userId);
  return accounts.map((a) => ({ id: a.id, email: a.email, provider: a.provider }));
}

// Merge free/busy across every connected calendar, dispatching per provider.
export async function mergedFreeBusyAll(accounts: CalendarAccount[], timeMinMs: number, timeMaxMs: number): Promise<BusyInterval[]> {
  const chunks = await Promise.all(
    accounts.map((a) =>
      a.provider === "google" ? mergedFreeBusy([a], timeMinMs, timeMaxMs) : microsoftFreeBusy([a], timeMinMs, timeMaxMs),
    ),
  );
  return chunks.flat();
}

export type CreateEventOpts = {
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  startMs: number;
  endMs: number;
  timeZone: string;
  inviteeEmail: string;
  inviteeName: string;
  // Pre-created external video link (e.g. Zoom) to embed in the event. Google
  // ignores this (it mints its own Meet link); Outlook embeds it.
  videoLink?: string;
};

export async function createEventOn(account: CalendarAccount, opts: CreateEventOpts): Promise<{ event?: CreatedEvent; error?: string }> {
  return account.provider === "google" ? createBookingEvent(account, opts) : createMicrosoftEvent(account, opts);
}

export async function deleteEventOn(account: CalendarAccount, eventId: string): Promise<void> {
  return account.provider === "google" ? deleteBookingEvent(account, eventId) : deleteMicrosoftEvent(account, eventId);
}
