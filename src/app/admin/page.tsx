import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { firstAccessibleSection, PLATFORM_SECTIONS } from "@/lib/auth/platform";

export default async function AdminIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) redirect("/dashboard");
  // Land the staff member on the first section they can actually access.
  const first = firstAccessibleSection(profile.platformAccess);
  if (!first) redirect("/dashboard");
  redirect(PLATFORM_SECTIONS.find((s) => s.key === first)!.href);
}
