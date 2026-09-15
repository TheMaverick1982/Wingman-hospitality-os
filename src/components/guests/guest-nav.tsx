import { getCurrentProfile } from "@/lib/auth/profile";
import { accessibleGuestTabs } from "@/lib/guest-tabs";
import { GuestNavTabs } from "./guest-nav-tabs";

// Drop this at the top of each Guests page (Bounce Back, Reviews, Service
// Recovery, Journey). It figures out which tabs this person can open and renders
// the shared tab strip, so the four pages present as one "Guests" surface.
export async function GuestNav() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const tabs = accessibleGuestTabs(profile.accessRole, profile.permissionOverrides);
  return <GuestNavTabs tabs={tabs} />;
}
