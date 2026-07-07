import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getOrgLocations } from "@/lib/data/locations";
import { createClient } from "@/lib/supabase/server";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const isSuperAdmin = profile.accessRole === "super_admin";
  const locations = isSuperAdmin ? await getOrgLocations() : [];

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

  return (
    <div className="w-full flex min-h-full flex-1">
      <Sidebar
        accessRole={profile.accessRole}
        fullName={profile.fullName}
        locationName={sidebarLocation?.name || profile.orgName}
        repeatRate={repeatRate}
      />
      <div className="flex-1 flex flex-col min-w-0">
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
