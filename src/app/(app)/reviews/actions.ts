"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { composeReviewSummary } from "@/lib/review-summary";
import { execRecapEmailHtml } from "@/lib/review-email";
import { sendEmail } from "@/lib/email";
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

// Send the ownership recap right now, so an owner can see it without waiting for
// the schedule. Company-wide, all-time (so the test always has content to show),
// respecting the "This week" toggle. Goes to the saved ownership addresses, or to
// the owner running it if none are set yet. Super-admin only + rate-limited.
export async function sendExecRecapTestNow(): Promise<{ error: string | null; sentTo?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the owner can do that." };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("review_exec_include_actions, review_exec_emails")
    .eq("id", profile.orgId)
    .maybeSingle();
  const includeActions = (orgRow as { review_exec_include_actions?: boolean } | null)?.review_exec_include_actions !== false;
  const emailsRaw = (orgRow as { review_exec_emails?: string } | null)?.review_exec_emails ?? "";
  let recipients = emailsRaw.split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
  if (recipients.length === 0 && profile.email) recipients = [profile.email];
  if (recipients.length === 0) return { error: "Add an email address above first, then send a test." };

  // Broken down by location, stacked into one email — same shape the scheduled
  // recap sends. All-time (no window) so the test always has content. Run the
  // per-location summaries in PARALLEL so the button doesn't sit spinning while
  // several AI calls go one-by-one.
  const { data: locs } = await admin.from("locations").select("id, name").eq("org_id", profile.orgId).order("name");
  const locations = (locs ?? []) as { id: string; name: string }[];
  const results = await Promise.all(
    locations.map(async (loc) => {
      const r = await composeReviewSummary(admin, {
        orgId: profile.orgId,
        orgName: profile.orgName,
        scopeLocationId: loc.id,
        includeActions,
        includeQuotes: true,
      });
      return !r.error && r.summary ? { locationName: loc.name, summary: r.summary } : null;
    }),
  );
  const sections = results.filter((s): s is { locationName: string; summary: string } => s !== null);
  if (sections.length === 0) return { error: "No guest feedback yet to summarize." };

  const html = execRecapEmailHtml({
    orgName: profile.orgName,
    periodTitle: "Ownership recap — test",
    subLine: `Sample company-wide guest feedback, broken down by location. This is a test you triggered.`,
    sections,
    footer: `Test recap sent from Guests → Reviews. The scheduled recap covers just the recent period; this test shows all-time so there's always something to see.`,
  });
  try {
    await sendEmail({ to: recipients, subject: `[Test] Ownership recap — ${profile.orgName}`, html });
  } catch {
    return { error: "Couldn't send the test email. Try again." };
  }
  return { error: null, sentTo: recipients.join(", ") };
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
