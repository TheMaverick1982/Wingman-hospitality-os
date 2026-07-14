import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getOrgLocations } from "@/lib/data/locations";
import { createClient } from "@/lib/supabase/server";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { getLaunchPlan } from "@/lib/launch-plan";
import { Sidebar } from "@/components/app-shell/sidebar";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Topbar } from "@/components/app-shell/topbar";
import { ImpersonationBanner } from "@/components/app-shell/impersonation-banner";
import { DemoBanner } from "@/components/app-shell/demo-banner";
import { DemoTour } from "@/components/demo/demo-tour";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { FirstLoginLanguage } from "@/components/app-shell/first-login-language";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const isSuperAdmin = profile.accessRole === "super_admin";
  const locations = await getOrgLocations();
  // Keep "Start here" in the sidebar through the whole 14-day launch — including
  // the usage milestones — not just until setup is done.
  const launch = isSuperAdmin ? await getLaunchPlan() : null;

  const supabase = await createClient();
  const { data: guests } = await supabase
    .from("guests")
    .select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)");
  const guestRows = (guests ?? []) as GuestWithVisits[];

  const cookieStore = await cookies();
  const isImpersonating = Boolean(cookieStore.get("wingman_impersonator_refresh")?.value);

  // Which locations this member can switch between in the top bar.
  const canSpanLocations = isSuperAdmin || profile.allLocations || profile.accessibleLocationIds.length > 0;
  const switchableLocations =
    isSuperAdmin || profile.allLocations
      ? locations
      : locations.filter((l) => l.id === profile.locationId || profile.accessibleLocationIds.includes(l.id));

  // Per-location repeat rates so the sidebar footer can follow the top-bar
  // location switcher (which lives in the `?location=` URL param), instead of
  // being stuck on one location. When nothing is selected we fall back to the
  // same default the top bar shows: "All locations" for members who can span
  // locations, otherwise their home location.
  const locationStats = switchableLocations.map((l) => ({
    id: l.id,
    name: l.name,
    repeatRate: computeRepeatRate(guestRows, l.id),
  }));
  const showsAllLocationsDefault = canSpanLocations && switchableLocations.length > 1;
  const homeLocation = profile.locationId
    ? switchableLocations.find((l) => l.id === profile.locationId) ?? null
    : null;
  const fallbackLocationName = showsAllLocationsDefault
    ? "All locations"
    : homeLocation?.name || profile.locationName || profile.orgName;
  const fallbackRepeatRate = showsAllLocationsDefault
    ? computeRepeatRate(guestRows, null)
    : computeRepeatRate(guestRows, homeLocation?.id ?? profile.locationId ?? null);

  return (
    <div className="w-full flex min-h-full flex-1">
      <Sidebar
        accessRole={profile.accessRole}
        fullName={profile.fullName}
        locationStats={locationStats}
        fallbackLocationName={fallbackLocationName}
        fallbackRepeatRate={fallbackRepeatRate}
        isPlatformAdmin={profile.isPlatformAdmin}
        permissionOverrides={profile.permissionOverrides}
        showStartHere={!!launch && !launch.allDone}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {isImpersonating && <ImpersonationBanner viewingName={profile.fullName || profile.orgName} />}
        {profile.isDemoSandbox && <DemoBanner email={profile.demoLeadEmail} />}
        <MobileNav
          accessRole={profile.accessRole}
          fullName={profile.fullName}
          locationStats={locationStats}
          fallbackLocationName={fallbackLocationName}
          fallbackRepeatRate={fallbackRepeatRate}
          isPlatformAdmin={profile.isPlatformAdmin}
          permissionOverrides={profile.permissionOverrides}
          showStartHere={!!launch && !launch.allDone}
        />
        <Topbar
          locations={switchableLocations}
          canSwitch={canSpanLocations}
          orgIsMultiLocation={locations.length > 1}
          userLocationName={profile.locationName}
          language={profile.language}
        />
        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden flex-1 bg-paper">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-6 min-w-0">{children}</div>
        </div>
      </div>
      <AssistantWidget />
      {profile.isDemoSandbox && <DemoTour email={profile.demoLeadEmail} />}
      {!profile.languageChosen && <FirstLoginLanguage />}
    </div>
  );
}
