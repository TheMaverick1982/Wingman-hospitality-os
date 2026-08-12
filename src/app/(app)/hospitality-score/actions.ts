"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import { isValidScores, totalScore } from "@/lib/hospitality-score";

// Record a Hospitality Score self-assessment for a scope:
//   locationId = null  -> the whole-company score (owner only)
//   locationId = <id>  -> that one location's score (owner, or a manager who
//                         actually has access to that location)
export async function submitAssessment(scores: number[], locationId: string | null): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!isValidScores(scores)) return { error: "Please rate all ten statements from 1 to 10." };

  const isOwner = profile.accessRole === "super_admin";

  if (locationId === null) {
    // The company-wide assessment is the owner's read on the overall culture.
    if (!isOwner) return { error: "Only the owner can take the company-wide assessment." };
  } else {
    // A location's own assessment: the owner, or a manager who can reach it.
    const reachable = isOwner || profile.allLocations || profile.locationId === locationId || profile.accessibleLocationIds.includes(locationId);
    if (!isManagerOrAbove(profile.accessRole) || !reachable) {
      return { error: "You don't have access to that location." };
    }
    // The location must belong to this org.
    const admin = createAdminClient();
    const { data: loc } = await admin.from("locations").select("id").eq("id", locationId).eq("org_id", profile.orgId).maybeSingle();
    if (!loc) return { error: "That location wasn't found." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("hospitality_assessments").insert({
    org_id: profile.orgId,
    location_id: locationId,
    created_by: profile.userId,
    scores,
    total: totalScore(scores),
  });
  if (error) return { error: "Couldn't save your assessment. Try again." };
  revalidatePath("/hospitality-score");
  return { error: null };
}
