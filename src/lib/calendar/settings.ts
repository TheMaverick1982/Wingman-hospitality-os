import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityRule } from "./availability";
import type { GoogleAccountRow } from "./google";
import type { MicrosoftAccountRow } from "./microsoft";

export type CalendarSettings = {
  user_id: string;
  slug: string;
  time_zone: string;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  advance_notice_hours: number;
  booking_window_days: number;
  availability: AvailabilityRule[];
  page_title: string;
  page_description: string;
  is_active: boolean;
  in_demo_pool: boolean;
};

// Shared config for the public round-robin /book-a-demo page.
export type DemoPoolConfig = {
  time_zone: string;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  advance_notice_hours: number;
  booking_window_days: number;
  availability: AvailabilityRule[];
  page_title: string;
  page_description: string;
  is_active: boolean;
};

export type PublicAccountInfo = { id: string; email: string; provider: "google" | "microsoft" };

// A sensible Mon–Fri 9–5 default so a freshly-connected rep has something to edit.
export const DEFAULT_AVAILABILITY: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start: "09:00",
  end: "17:00",
}));

export function normalizeAvailability(raw: unknown): AvailabilityRule[] {
  if (!Array.isArray(raw)) return [];
  const out: AvailabilityRule[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const weekday = Number(r.weekday);
    const start = typeof r.start === "string" ? r.start : "";
    const end = typeof r.end === "string" ? r.end : "";
    if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 && /^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end)) {
      out.push({ weekday, start, end });
    }
  }
  return out;
}

function rowToSettings(row: Record<string, unknown>): CalendarSettings {
  return {
    user_id: String(row.user_id),
    slug: String(row.slug ?? ""),
    time_zone: String(row.time_zone ?? "America/New_York"),
    meeting_duration_minutes: Number(row.meeting_duration_minutes ?? 30),
    buffer_minutes: Number(row.buffer_minutes ?? 0),
    advance_notice_hours: Number(row.advance_notice_hours ?? 12),
    booking_window_days: Number(row.booking_window_days ?? 21),
    availability: normalizeAvailability(row.availability),
    page_title: String(row.page_title ?? ""),
    page_description: String(row.page_description ?? ""),
    is_active: Boolean(row.is_active),
    in_demo_pool: Boolean(row.in_demo_pool),
  };
}

export async function getCalendarSettings(userId: string): Promise<CalendarSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_settings").select("*").eq("user_id", userId).maybeSingle();
  return data ? rowToSettings(data as Record<string, unknown>) : null;
}

export async function getCalendarSettingsBySlug(slug: string): Promise<CalendarSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_settings").select("*").eq("slug", slug).maybeSingle();
  return data ? rowToSettings(data as Record<string, unknown>) : null;
}

// The shared /book-a-demo config (singleton). Returns sensible defaults if the
// row hasn't been created yet.
export async function getDemoPoolConfig(): Promise<DemoPoolConfig> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_demo_pool").select("*").eq("id", true).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    time_zone: String(row.time_zone ?? "America/New_York"),
    meeting_duration_minutes: Number(row.meeting_duration_minutes ?? 30),
    buffer_minutes: Number(row.buffer_minutes ?? 0),
    advance_notice_hours: Number(row.advance_notice_hours ?? 12),
    booking_window_days: Number(row.booking_window_days ?? 21),
    availability: normalizeAvailability(row.availability ?? DEFAULT_AVAILABILITY),
    page_title: String(row.page_title ?? "Book a demo"),
    page_description: String(row.page_description ?? ""),
    is_active: Boolean(row.is_active),
  };
}

// Reps whose calendars feed the round-robin demo pool (active pages only).
export async function listDemoPoolMembers(): Promise<CalendarSettings[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_settings")
    .select("*")
    .eq("in_demo_pool", true)
    .eq("is_active", true);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToSettings);
}

// Accounts for a user, full rows (tokens included) — server-only callers.
export async function listGoogleAccounts(userId: string): Promise<GoogleAccountRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_google_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("connected_at", { ascending: true });
  return (data ?? []) as GoogleAccountRow[];
}

export async function listMicrosoftAccounts(userId: string): Promise<MicrosoftAccountRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_microsoft_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("connected_at", { ascending: true });
  return (data ?? []) as MicrosoftAccountRow[];
}

// Seed a booking-settings row on first calendar connect (either provider), so the
// rep lands on a ready-to-edit page. No-op if they already have one.
export async function seedCalendarSettingsIfMissing(userId: string, fullName: string): Promise<void> {
  const existing = await getCalendarSettings(userId);
  if (existing) return;
  const slug = await ensureUniqueSlug(fullName || "rep", userId);
  const admin = createAdminClient();
  await admin.from("calendar_settings").insert({
    user_id: userId,
    slug,
    time_zone: "America/New_York",
    availability: DEFAULT_AVAILABILITY,
    page_title: `Book a meeting with ${fullName || "our team"}`,
    is_active: false,
  });
}

const SLUG_CLEAN = /[^a-z0-9]+/g;

export function slugify(input: string): string {
  return input.toLowerCase().replace(SLUG_CLEAN, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// A unique booking slug seeded from the rep's name (falls back to "rep"), with a
// short suffix appended on collision.
export async function ensureUniqueSlug(base: string, forUserId: string): Promise<string> {
  const admin = createAdminClient();
  const seed = slugify(base) || "rep";
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${attempt + 1}`;
    const { data } = await admin.from("calendar_settings").select("user_id").eq("slug", candidate).maybeSingle();
    if (!data || (data as { user_id: string }).user_id === forUserId) return candidate;
  }
  return `${seed}-${forUserId.slice(0, 8)}`;
}

export type BookingRow = {
  id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_notes: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  meet_link: string;
  html_link: string;
  status: string;
  created_at: string;
};

export async function listUpcomingBookings(userId: string, limit = 25): Promise<BookingRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_bookings")
    .select("id, invitee_name, invitee_email, invitee_notes, start_at, end_at, time_zone, meet_link, html_link, status, created_at")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as BookingRow[];
}
