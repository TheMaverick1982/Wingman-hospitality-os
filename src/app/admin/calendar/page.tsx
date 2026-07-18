import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { googleCalendarConfigured, siteUrl } from "@/lib/calendar/google";
import { microsoftCalendarConfigured } from "@/lib/calendar/microsoft";
import {
  getCalendarSettings,
  getDemoPoolConfig,
  listDemoPoolMembers,
  listUpcomingBookings,
  slugify,
} from "@/lib/calendar/settings";
import { listCalendarAccountsPublic } from "@/lib/calendar/providers";
import { CalendarMount } from "./calendar-mount";

export const metadata: Metadata = { title: "Calendar · Admin" };

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isPlatformAdmin) redirect("/dashboard");

  const sp = await searchParams;
  // Both providers report status via ?g= (Google) or ?m= (Microsoft); the banner
  // copy is provider-neutral so either works.
  const flag = (typeof sp.g === "string" ? sp.g : "") || (typeof sp.m === "string" ? sp.m : "");
  const flagMsg = typeof sp.msg === "string" ? sp.msg : "";

  const isSuper = PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));

  // Guarded/isolated reads: a single failing query (e.g. a not-yet-applied
  // migration) degrades that section instead of taking down the whole page. The
  // real error is logged so it shows up in the server logs.
  const guard = async <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      console.error(`[calendar] ${label} read failed:`, e);
      return fallback;
    }
  };

  const DEFAULT_DEMO = {
    time_zone: "America/New_York",
    meeting_duration_minutes: 30,
    buffer_minutes: 0,
    advance_notice_hours: 12,
    booking_window_days: 21,
    availability: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })),
    page_title: "Book a demo",
    page_description: "",
    is_active: false,
  };

  const [settings, accounts, bookings, demoConfig, demoMembers] = await Promise.all([
    guard("settings", getCalendarSettings(profile.userId), null),
    guard("accounts", listCalendarAccountsPublic(profile.userId), []),
    guard("bookings", listUpcomingBookings(profile.userId), []),
    guard("demoConfig", getDemoPoolConfig(), DEFAULT_DEMO),
    guard("demoMembers", listDemoPoolMembers(), []),
  ]);

  const defaultSlug = settings?.slug || slugify(profile.fullName || "rep") || "rep";

  return (
    <CalendarMount
      googleConfigured={googleCalendarConfigured()}
      microsoftConfigured={microsoftCalendarConfigured()}
      baseUrl={siteUrl()}
      accounts={accounts}
      settings={
        settings ?? {
          user_id: profile.userId,
          slug: defaultSlug,
          time_zone: "America/New_York",
          meeting_duration_minutes: 30,
          buffer_minutes: 0,
          advance_notice_hours: 12,
          booking_window_days: 21,
          availability: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })),
          page_title: `Book a meeting with ${profile.fullName || "our team"}`,
          page_description: "",
          is_active: false,
          in_demo_pool: false,
        }
      }
      bookings={bookings}
      flag={flag}
      flagMsg={flagMsg}
      isSuper={isSuper}
      demoConfig={demoConfig}
      demoMemberCount={demoMembers.length}
    />
  );
}
