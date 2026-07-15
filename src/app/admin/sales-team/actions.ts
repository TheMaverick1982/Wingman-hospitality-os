"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { generateRepReport, type RepReport } from "@/lib/sales-cert";

// Generate a fresh AI coaching report for a rep. Owner-only.
export async function generateRepReportAction(userId: string): Promise<{ error: string | null; report?: RepReport }> {
  const profile = await getCurrentProfile();
  const isSuper = profile?.isPlatformAdmin && PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));
  if (!isSuper) return { error: "Not authorized." };
  if (!userId) return { error: "Missing rep." };
  const report = await generateRepReport(userId);
  if (!report) return { error: "No completed test to report on yet (or the AI is unavailable)." };
  revalidatePath(`/admin/sales-team/${userId}`);
  return { error: null, report };
}
