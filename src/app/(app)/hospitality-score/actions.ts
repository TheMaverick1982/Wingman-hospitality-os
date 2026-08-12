"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidScores, totalScore } from "@/lib/hospitality-score";

// Record a Hospitality Score self-assessment. Owner-only (super_admin) — it's the
// owner's read on their own culture. Managers can view history but not submit.
export async function submitAssessment(scores: number[]): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the owner can take the assessment." };
  if (!isValidScores(scores)) return { error: "Please rate all ten statements from 1 to 10." };

  const admin = createAdminClient();
  const { error } = await admin.from("hospitality_assessments").insert({
    org_id: profile.orgId,
    created_by: profile.userId,
    scores,
    total: totalScore(scores),
  });
  if (error) return { error: "Couldn't save your assessment. Try again." };
  revalidatePath("/hospitality-score");
  return { error: null };
}
