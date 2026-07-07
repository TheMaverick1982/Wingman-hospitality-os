import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { AdminSidebar } from "@/components/admin-shell/admin-sidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isPlatformAdmin) redirect("/dashboard");

  return (
    <div className="w-full flex min-h-full flex-1">
      <AdminSidebar fullName={profile.fullName} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-8 overflow-y-auto flex-1 bg-paper">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
