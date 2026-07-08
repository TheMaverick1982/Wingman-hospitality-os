import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getOrgLocations } from "@/lib/data/locations";
import { createClient } from "@/lib/supabase/server";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { getOnboardingStatus } from "@/lib/onboarding";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { ImpersonationBanner } from "@/components/app-shell/impersonation-banner";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const isSuperAdmin = profile.accessRole === "super_admin";
  const locations = await getOrgLocations();
  const onboarding = isSuperAdmin ? await getOnboardingStatus() : null;

  const supabase = await createClient();
  const sidebarLocation = isSuperAdmin
    ? locations[0]
      ? { id: locations[0].id, name: locations[0].name }
      : null
    : profile.locationId
      ? { id: profile.locationId, name: profile.locationName ?? "" }
      : null;
  const { data: guests } = await supabase
    .from("guests")
    .select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)");
  const repeatRate = computeRepeatRate((guests ?? []) as GuestWithVisits[], sidebarLocation?.id ?? null);

  const cookieStore = await cookies();
  const isImpersonating = Boolean(cookieStore.get("wingman_impersonator_refresh")?.value);

  return (
    <div className="w-full flex min-h-full flex-1">
      <Sidebar
        accessRole={profile.accessRole}
        fullName={profile.fullName}
        locationName={sidebarLocation?.name || profile.orgName}
        repeatRate={repeatRate}
        isPlatformAdmin={profile.isPlatformAdmin}
        permissionOverrides={profile.permissionOverrides}
        showStartHere={!!onboarding && !onboarding.allDone}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {isImpersonating && <ImpersonationBanner viewingName={profile.fullName || profile.orgName} />}
        <Topbar
          accessRole={profile.accessRole}
          locations={locations}
          userLocationName={profile.locationName}
        />
        <div className="p-8 overflow-y-auto flex-1 bg-paper">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
