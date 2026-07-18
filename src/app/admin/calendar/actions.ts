"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureUniqueSlug,
  normalizeAvailability,
  slugify,
  getCalendarSettings,
  DEFAULT_AVAILABILITY,
} from "@/lib/calendar/settings";
import { listCalendarAccounts } from "@/lib/calendar/providers";
import type { AvailabilityRule } from "@/lib/calendar/availability";
import { isValidTimeZone } from "@/lib/calendar/timezones";

const DURATIONS = new Set([15, 20, 30, 45, 60]);

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

type SaveInput = {
  slug: string;
  timeZone: string;
  meetingDurationMinutes: number;
  bufferMinutes: number;
  advanceNoticeHours: number;
  bookingWindowDays: number;
  availability: AvailabilityRule[];
  pageTitle: string;
  pageDescription: string;
  isActive: boolean;
};

// Save the signed-in rep's own booking settings. Any platform staffer manages
// their own calendar.
export async function saveCalendarSettings(input: SaveInput): Promise<{ error: string | null; slug?: string }> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return { error: "Not authorized." };

  const admin = createAdminClient();

  // Ensure a row exists (they may not have connected yet, but can still draft).
  const existing = await getCalendarSettings(profile.userId);

  const cleanSlug = slugify(input.slug || profile.fullName || "rep");
  if (!cleanSlug) return { error: "Choose a booking link." };
  // Keep the slug unique across reps (and stable if it's already theirs).
  let slug = cleanSlug;
  if (!existing || existing.slug !== cleanSlug) {
    slug = await ensureUniqueSlug(cleanSlug, profile.userId);
  }

  const tz = isValidTimeZone(input.timeZone) ? input.timeZone : "America/New_York";
  const duration = DURATIONS.has(input.meetingDurationMinutes) ? input.meetingDurationMinutes : 30;
  const buffer = Math.min(120, Math.max(0, Math.round(input.bufferMinutes || 0)));
  const notice = Math.min(168, Math.max(0, Math.round(input.advanceNoticeHours || 0)));
  const windowDays = Math.min(90, Math.max(1, Math.round(input.bookingWindowDays || 21)));
  const availability = normalizeAvailability(input.availability);

  const payload = {
    user_id: profile.userId,
    slug,
    time_zone: tz,
    meeting_duration_minutes: duration,
    buffer_minutes: buffer,
    advance_notice_hours: notice,
    booking_window_days: windowDays,
    availability,
    page_title: input.pageTitle.trim().slice(0, 160),
    page_description: input.pageDescription.trim().slice(0, 600),
    is_active: Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("calendar_settings").upsert(payload, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath("/admin/calendar");
  return { error: null, slug };
}

// Disconnect one connected calendar (does not delete already-booked meetings).
export async function disconnectCalendarAccount(
  provider: "google" | "microsoft",
  accountId: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return { error: "Not authorized." };
  const table = provider === "microsoft" ? "calendar_microsoft_accounts" : "calendar_google_accounts";
  const admin = createAdminClient();
  // Scope the delete to the caller's own row so one rep can't remove another's.
  const { error } = await admin.from(table).delete().eq("id", accountId).eq("user_id", profile.userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/calendar");
  return { error: null };
}

// Add or remove the signed-in rep's calendars from the round-robin /book-a-demo
// pool. Requires an active page and a connected calendar to join.
export async function setDemoPoolMembership(inPool: boolean): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return { error: "Not authorized." };
  const admin = createAdminClient();

  if (inPool) {
    const settings = await getCalendarSettings(profile.userId);
    if (!settings || !settings.is_active) return { error: "Turn your booking page on before joining the demo pool." };
    const accounts = await listCalendarAccounts(profile.userId);
    if (!accounts.length) return { error: "Connect a calendar before joining the demo pool." };
  }

  const { error } = await admin
    .from("calendar_settings")
    .update({ in_demo_pool: inPool, updated_at: new Date().toISOString() })
    .eq("user_id", profile.userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/calendar");
  return { error: null };
}

type DemoConfigInput = {
  timeZone: string;
  meetingDurationMinutes: number;
  bufferMinutes: number;
  advanceNoticeHours: number;
  bookingWindowDays: number;
  availability: AvailabilityRule[];
  pageTitle: string;
  pageDescription: string;
  isActive: boolean;
};

// Save the shared /book-a-demo config (singleton). Owner-only (a platform admin
// with every section granted), since it's platform-wide, not personal.
export async function saveDemoPoolConfig(input: DemoConfigInput): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  const isSuper = profile?.isPlatformAdmin && PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));
  if (!isSuper) return { error: "Only an owner can edit the demo pool." };

  const admin = createAdminClient();
  const payload = {
    id: true,
    time_zone: isValidTimeZone(input.timeZone) ? input.timeZone : "America/New_York",
    meeting_duration_minutes: DURATIONS.has(input.meetingDurationMinutes) ? input.meetingDurationMinutes : 30,
    buffer_minutes: clampInt(input.bufferMinutes, 0, 120, 0),
    advance_notice_hours: clampInt(input.advanceNoticeHours, 0, 168, 12),
    booking_window_days: clampInt(input.bookingWindowDays, 1, 90, 21),
    availability: normalizeAvailability(input.availability),
    page_title: input.pageTitle.trim().slice(0, 160) || "Book a demo",
    page_description: input.pageDescription.trim().slice(0, 600),
    is_active: Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("calendar_demo_pool").upsert(payload, { onConflict: "id" });
  if (error) return { error: error.message };
  revalidatePath("/admin/calendar");
  return { error: null };
}

export { DEFAULT_AVAILABILITY };
