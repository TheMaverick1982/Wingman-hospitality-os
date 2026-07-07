import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getOrgLocations } from "@/lib/data/locations";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const isGm = profile.accessRole === "gm";
  const locations = isGm ? await getOrgLocations() : [];

  return (
    <div className="w-full flex min-h-full flex-1">
      <Sidebar orgName={profile.orgName} isGm={isGm} fullName={profile.fullName} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar isGm={isGm} locations={locations} userLocationName={profile.locationName} />
        <div className="p-8 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
