import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { logLoginOncePerWindow } from "@/lib/activity-log";
import { getOrgLocations } from "@/lib/data/locations";
import { createClient } from "@/lib/supabase/server";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { getLaunchPlan } from "@/lib/launch-plan";
import { Sidebar } from "@/components/app-shell/sidebar";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Topbar } from "@/components/app-shell/topbar";
import { ScrollReset } from "@/components/app-shell/scroll-reset";
import { ImpersonationBanner } from "@/components/app-shell/impersonation-banner";
import { DemoBanner } from "@/components/app-shell/demo-banner";
import { DemoViewToggle } from "@/components/app-shell/demo-view-toggle";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { FirstLoginLanguage } from "@/components/app-shell/first-login-language";
import { CloverFinalize } from "@/components/app-shell/clover-finalize";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  // Record a login for the staff-activity trail (throttled to once per session).
  await logLoginOncePerWindow(profile.orgId, profile.userId, profile.fullName);

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
  // A Clover App-Market install waiting to be linked to this org after sign-in.
  const hasPendingClover = Boolean(cookieStore.get("clover_pending")?.value);

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

  // Badge on the Questions nav: how many staff questions are waiting for a
  // manager. Only computed for those who can answer (RLS already scopes the
  // count to this org); guarded so a not-yet-applied migration can't break the
  // whole app shell.
  let openQuestions = 0;
  if (getSectionAccess(profile.accessRole, "questions", profile.permissionOverrides) === "full") {
    try {
      const { count } = await supabase
        .from("staff_questions")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .is("deleted_at", null);
      openQuestions = count ?? 0;
    } catch {
      openQuestions = 0;
    }
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <Sidebar
        accessRole={profile.accessRole}
        fullName={profile.fullName}
        locationStats={locationStats}
        fallbackLocationName={fallbackLocationName}
        fallbackRepeatRate={fallbackRepeatRate}
        isPlatformAdmin={profile.isPlatformAdmin}
        isFranchiseAdmin={!!profile.franchiseGroupId}
        permissionOverrides={profile.permissionOverrides}
        showStartHere={!!launch && !launch.allDone}
        questionsBadge={openQuestions}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-x-hidden safe-inset-x safe-inset-b">
        {isImpersonating && <ImpersonationBanner viewingName={profile.fullName || profile.orgName} />}
        {profile.isDemoSandbox && <DemoBanner email={profile.demoLeadEmail} />}
        {profile.isDemo && <DemoViewToggle view={profile.accessRole === "staff" ? (profile.demoDept === "Chef" ? "chef" : profile.demoDept === "Bartender" ? "bartender" : "server") : "owner"} />}
        <MobileNav
          accessRole={profile.accessRole}
          fullName={profile.fullName}
          locationStats={locationStats}
          fallbackLocationName={fallbackLocationName}
          fallbackRepeatRate={fallbackRepeatRate}
          questionsBadge={openQuestions}
          isPlatformAdmin={profile.isPlatformAdmin}
          isFranchiseAdmin={!!profile.franchiseGroupId}
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
        <div id="app-scroll" className="px-5 py-5 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden flex-1 bg-paper">
          <ScrollReset targetId="app-scroll" />
          <div className="max-w-[1400px] mx-auto flex flex-col gap-6 min-w-0">{children}</div>
        </div>
      </div>
      <AssistantWidget />
      {/* Demos skip onboarding entirely: no product-tour coach marks (whose last
          step pushes a premature "create your account"), and no first-login
          language prompt. A rep is showing the product, and a self-serve visitor
          should get straight into it — not a signup wall. Real customers still
          get the language chooser on their first login. */}
      {!profile.isDemo && !profile.languageChosen && <FirstLoginLanguage />}
      {hasPendingClover && <CloverFinalize />}
    </div>
  );
}
