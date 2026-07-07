import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getOrgLocations } from "@/lib/data/locations";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const isSuperAdmin = profile.accessRole === "super_admin";
  const locations = isSuperAdmin ? await getOrgLocations() : [];

  return (
    <div className="w-full flex min-h-full flex-1">
      <Sidebar orgName={profile.orgName} accessRole={profile.accessRole} fullName={profile.fullName} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          accessRole={profile.accessRole}
          locations={locations}
          userLocationName={profile.locationName}
        />
        <div className="p-8 overflow-y-auto flex-1">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
