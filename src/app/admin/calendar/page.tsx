import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { googleCalendarConfigured, siteUrl } from "@/lib/calendar/google";
import {
  getCalendarSettings,
  getDemoPoolConfig,
  listDemoPoolMembers,
  listGoogleAccountsPublic,
  listUpcomingBookings,
  slugify,
} from "@/lib/calendar/settings";
import { CalendarClient } from "./calendar-client";

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
  const flag = typeof sp.g === "string" ? sp.g : "";
  const flagMsg = typeof sp.msg === "string" ? sp.msg : "";

  const isSuper = PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));

  const [settings, accounts, bookings, demoConfig, demoMembers] = await Promise.all([
    getCalendarSettings(profile.userId),
    listGoogleAccountsPublic(profile.userId),
    listUpcomingBookings(profile.userId),
    getDemoPoolConfig(),
    listDemoPoolMembers(),
  ]);

  const defaultSlug = settings?.slug || slugify(profile.fullName || "rep") || "rep";

  return (
    <CalendarClient
      configured={googleCalendarConfigured()}
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
