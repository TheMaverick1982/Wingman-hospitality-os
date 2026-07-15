"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { pushBrandTest } from "@/lib/franchise-brand";

// Push (or re-sync) one of the franchisor's own training tests to every
// franchisee. Franchise-admin only; the source is the admin's own org.
export async function pushBrandTestAction(testId: string, locked: boolean): Promise<{ error: string | null; pushed?: number }> {
  const profile = await getCurrentProfile();
  if (!profile?.franchiseGroupId || profile.franchiseRole !== "admin") return { error: "Only a franchisor admin can push brand content." };
  if (!testId) return { error: "Missing test." };
  const res = await pushBrandTest(profile.franchiseGroupId, profile.orgId, testId, locked);
  if (res.error) return { error: res.error };
  revalidatePath("/franchise/library");
  return { error: null, pushed: res.pushed };
}
