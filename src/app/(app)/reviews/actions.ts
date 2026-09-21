"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { composeReviewSummary } from "@/lib/review-summary";
import { pushCultureMomentToTeam } from "@/lib/culture-notify";

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

// Guest review -> Wins feed. Turn a survey response that named a server into a
// one-tap shout-out on the Culture page, tied to that teammate — so real guest
// praise becomes team recognition without retyping it. Idempotent per response.
export async function recognizeFromReview(responseId: string): Promise<{ error: string | null; staffName?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can do that." };
  }
  const admin = createAdminClient();
  const { data: resp } = await admin
    .from("guest_survey_responses")
    .select("id, org_id, server_staff_id, comment, recognized_at")
    .eq("id", responseId)
    .eq("org_id", profile.orgId)
    .maybeSingle();
  const r = resp as { id: string; server_staff_id: string | null; comment: string | null; recognized_at: string | null } | null;
  if (!r) return { error: "Review not found." };
  if (!r.server_staff_id) return { error: "This review didn't name a team member." };
  if (r.recognized_at) return { error: null }; // already recognized — no-op

  const { data: staff } = await admin.from("staff_members").select("full_name").eq("id", r.server_staff_id).eq("org_id", profile.orgId).maybeSingle();
  const staffName = (staff as { full_name?: string } | null)?.full_name?.trim();
  if (!staffName) return { error: "Couldn't find that team member." };

  const comment = (r.comment ?? "").trim();
  const message = comment
    ? `A guest called them out: “${comment.slice(0, 400)}”`
    : `A guest left a great review and named ${staffName.split(/\s+/)[0]}.`;

  const { error: insErr } = await admin.from("culture_moments").insert({
    org_id: profile.orgId,
    author: profile.fullName || "A manager",
    about: staffName,
    tag: null,
    value_id: null,
    kind: "shoutout",
    message,
    created_by: profile.userId,
  });
  if (insErr) return { error: "Couldn't post that shout-out. Try again." };

  await admin.from("guest_survey_responses").update({ recognized_at: new Date().toISOString() }).eq("id", r.id).eq("org_id", profile.orgId);

  // Buzz the team — a guest just called this teammate out by name.
  await pushCultureMomentToTeam({
    orgId: profile.orgId,
    authorId: profile.userId,
    authorName: profile.fullName || "A manager",
    kind: "shoutout",
    about: staffName,
    message,
  });

  revalidatePath("/reviews");
  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null, staffName };
}

// A master copy address (or several) that also receives the report digest, on
// top of each location's managers. Same free-form format as hiring's copy list.
export async function setReviewDigestCc(value: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can change this." };
  }
  const cleaned = value.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20).join(", ").slice(0, 600);
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ review_digest_cc: cleaned }).eq("id", profile.orgId);
  if (error) return { error: "Couldn't save that. Try again." };
  revalidatePath("/reviews");
  return { error: null };
}

export type ExecRecapFrequency = "off" | "daily" | "weekly";

// The ownership recap is the company-wide (all-locations) exec view of guest
// feedback, emailed to specific ownership addresses. It's controlled by the
// OWNER only — a stricter bar than the per-location digest — so these three are
// gated to super_admin, not just "reviews full" access.
export async function setExecRecapFrequency(freq: ExecRecapFrequency): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the owner can change this." };
  if (!["off", "daily", "weekly"].includes(freq)) return { error: "Invalid choice." };
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ review_exec_frequency: freq }).eq("id", profile.orgId);
  if (error) return { error: "Couldn't save that setting. Try again." };
  revalidatePath("/reviews");
  return { error: null };
}

export async function setExecRecapEmails(value: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the owner can change this." };
  const cleaned = value.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20).join(", ").slice(0, 600);
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ review_exec_emails: cleaned }).eq("id", profile.orgId);
  if (error) return { error: "Couldn't save that. Try again." };
  revalidatePath("/reviews");
  return { error: null };
}

export async function setExecRecapIncludeActions(enabled: boolean): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the owner can change this." };
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ review_exec_include_actions: enabled }).eq("id", profile.orgId);
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
