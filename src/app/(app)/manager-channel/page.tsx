import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { getManagerThreads } from "@/lib/manager-channel";
import { ManagerChannelClient } from "./manager-channel-client";

export const metadata = { title: "Manager channel · Wingman" };

// The manager channel: one org-wide channel for owners, managers, and shift
// leads to post updates and reply in threads. Staff never see it.
export default async function ManagerChannelPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "manager_channel", profile.permissionOverrides) === "none") redirect("/dashboard");

  const threads = await getManagerThreads(profile.orgId, profile.userId);

  return <ManagerChannelClient threads={threads} />;
}
