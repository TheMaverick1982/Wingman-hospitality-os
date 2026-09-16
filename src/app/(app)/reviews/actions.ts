"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { composeReviewSummary } from "@/lib/review-summary";

export type ReviewSummaryState = { error: string | null; summary?: string };

export type ReviewDigestFrequency = "off" | "weekly" | "monthly";

// Owner sets how often (if at all) the combined guest-feedback report auto-emails
// to each location's managers + the owner. Stored per org; the review-digest cron
// reads it. Manager-gated, same bar as the AI summary.
export async function setReviewDigestFrequency(freq: ReviewDigestFrequency): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can change this." };
  }
  if (!["off", "weekly", "monthly"].includes(freq)) return { error: "Invalid choice." };
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ review_digest_frequency: freq }).eq("id", profile.orgId);
  if (error) return { error: "Couldn't save that setting. Try again." };
  revalidatePath("/reviews");
  return { error: null };
}

// Toggle the guest survey's "Who took care of you?" staff picker for the whole
// org. Manager-gated (reviews "full" access), same bar as the AI summary.
export async function setSurveyAskServer(enabled: boolean): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can change this." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ survey_ask_server: enabled }).eq("id", profile.orgId);
  if (error) return { error: "Couldn't save that setting. Try again." };
  revalidatePath("/reviews");
  return { error: null };
}

export async function generateReviewSummary(scopeLocationId: string | null): Promise<ReviewSummaryState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can generate this." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const admin = createAdminClient();
  const res = await composeReviewSummary(admin, { orgId: profile.orgId, orgName: profile.orgName, scopeLocationId });
  return { error: res.error, summary: res.summary };
}
