import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile, type CurrentProfile } from "./profile";
import { canAccessPlatformSection, type PlatformSection } from "./platform";

// Gate an /admin page to a specific section. Non-platform-admins go to the app;
// platform staff without this section are sent to /admin (which routes them to a
// section they can access).
export async function requirePlatformSection(section: PlatformSection): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) redirect("/dashboard");
  if (!canAccessPlatformSection(profile.platformAccess, section)) redirect("/admin");
  return profile;
}

// For server actions: returns the profile if it's platform staff with the
// section, else null (the caller returns an error rather than redirecting).
export async function platformSectionActor(section: PlatformSection): Promise<CurrentProfile | null> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return null;
  if (!canAccessPlatformSection(profile.platformAccess, section)) return null;
  return profile;
}
