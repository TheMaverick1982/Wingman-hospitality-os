"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { CULTURE_TAGS } from "@/lib/constants";
import { WIN_KIND_IDS } from "@/lib/wins";
import { consumeAiLimit } from "@/lib/rate-limit";
import { composeCultureRecap } from "@/lib/culture-recap";

export type ActionState = { error: string | null };

export async function updateWeeklyFocus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const weeklyFocus = String(formData.get("weeklyFocus") || "").trim();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase.from("organizations").update({ weekly_focus: weeklyFocus }).eq("id", org.id);
  if (error) return { error: error.message };

  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null };
}

// Save the org's core values (add / edit / reorder / remove). Diffed by id so an
// existing value's hiring criteria (the hiring_question / green_flag / red_flag
// that live on the same row) are preserved on edit — only title, description, and
// order change. New rows are inserted; rows the owner removed are deleted (which
// also removes that value from the universal hiring criteria, by design).
export type CoreValueInput = { id: string | null; title: string; description: string };

export async function updateCoreValues(values: CoreValueInput[]): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) !== "full")
    return { error: "You don't have access to edit core values." };

  // Keep only rows with a real title; cap counts and lengths.
  const clean = (Array.isArray(values) ? values : [])
    .map((v) => ({
      id: typeof v?.id === "string" && v.id ? v.id : null,
      title: String(v?.title ?? "").trim().slice(0, 80),
      description: String(v?.description ?? "").trim().slice(0, 400),
    }))
    .filter((v) => v.title)
    .slice(0, 12);
  if (clean.length === 0) return { error: "Add at least one core value." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const orgId = (org as { id: string }).id;

  const { data: existingRows } = await supabase.from("core_values").select("id").eq("org_id", orgId);
  const existingIds = new Set(((existingRows ?? []) as { id: string }[]).map((r) => r.id));
  const keptIds = new Set<string>();

  for (let i = 0; i < clean.length; i++) {
    const v = clean[i];
    if (v.id && existingIds.has(v.id)) {
      keptIds.add(v.id);
      const { error } = await supabase
        .from("core_values")
        .update({ title: v.title, description: v.description, sort_order: i })
        .eq("id", v.id)
        .eq("org_id", orgId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("core_values")
        .insert({ org_id: orgId, title: v.title, description: v.description, sort_order: i });
      if (error) return { error: error.message };
    }
  }

  // Delete rows the owner removed from the list.
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from("core_values").delete().eq("org_id", orgId).in("id", toDelete);
    if (error) return { error: error.message };
  }

  revalidatePath("/culture");
  revalidatePath("/hiring");
  return { error: null };
}

const CULTURE_TEXT_FIELDS = { x_factor: true, weekly_experiment: true, owner_mindset: true } as const;

export async function updateCultureText(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const field = String(formData.get("field") || "");
  const value = String(formData.get("value") || "").trim();
  if (!(field in CULTURE_TEXT_FIELDS)) return { error: "Invalid field." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase
    .from("organizations")
    .update({ [field]: value })
    .eq("id", org.id);
  if (error) return { error: error.message };

  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null };
}

const EXPERIMENT_OUTCOMES = ["worked", "no_change", "mixed"] as const;
export type ExperimentOutcome = (typeof EXPERIMENT_OUTCOMES)[number];

// Close the weekly-experiment loop. Recording how the currently-running
// experiment went archives it (with its result) into the experiment log and
// clears organizations.weekly_experiment so the next one can be set. This is
// what turns the weekly experiment from a write-only field into a history the
// team can learn from ("we tried dessert-by-name — attach rate moved" / "no
// change"). Additive: nothing existing is deleted.
export async function closeExperiment(outcome: string, note: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) !== "full")
    return { error: "You don't have access to record experiment outcomes." };
  if (!EXPERIMENT_OUTCOMES.includes(outcome as ExperimentOutcome)) return { error: "Pick an outcome." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, weekly_experiment").single();
  if (!org) return { error: "Organization not found." };
  const hypothesis = String((org as { weekly_experiment?: string | null }).weekly_experiment ?? "").trim();
  if (!hypothesis) return { error: "There's no experiment running to record." };

  const { error: insErr } = await supabase.from("culture_experiments").insert({
    org_id: (org as { id: string }).id,
    hypothesis,
    outcome,
    outcome_note: note.trim().slice(0, 400) || null,
    closed_on: new Date().toISOString().slice(0, 10),
    created_by: profile.userId,
  });
  if (insErr) return { error: insErr.message };

  const { error: clearErr } = await supabase
    .from("organizations")
    .update({ weekly_experiment: "" })
    .eq("id", (org as { id: string }).id);
  if (clearErr) return { error: clearErr.message };

  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null };
}

// Remove a logged experiment (manager moderation / mistakes). The log is small,
// non-critical culture history, so a hard delete is fine (RLS enforces manager).
export async function deleteExperiment(id: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) !== "full")
    return { error: "Not allowed." };

  const supabase = await createClient();
  const { error } = await supabase.from("culture_experiments").delete().eq("id", id).eq("org_id", profile.orgId);
  if (error) return { error: "Couldn't remove that." };

  revalidatePath("/culture");
  return { error: null };
}

// Owner opt-in for the Monthly Culture Recap email: an AI-written summary of the
// month's recognition, anonymous pulse, and experiments, auto-emailed to the
// owner + managers on the 1st. Manager-gated (culture "full" access). Stored per
// org; the culture-recap cron reads it.
export async function setCultureRecapEnabled(enabled: boolean): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) !== "full")
    return { error: "Only managers can change this." };
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ culture_recap_enabled: enabled }).eq("id", profile.orgId);
  if (error) return { error: "Couldn't save that setting. Try again." };
  revalidatePath("/culture");
  return { error: null };
}

export type CultureRecapPreviewState = { error: string | null; summary?: string; monthLabel?: string };

// On-demand preview of the recap the cron would send — so an owner can see it
// before turning the monthly email on. Manager-gated + rate-limited like other
// AI generation.
export async function previewCultureRecap(): Promise<CultureRecapPreviewState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) !== "full")
    return { error: "Only managers can generate this." };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const admin = createAdminClient();
  const res = await composeCultureRecap(admin, { orgId: profile.orgId, orgName: profile.orgName });
  return { error: res.error, summary: res.summary, monthLabel: res.monthLabel };
}

// Post to the Wins feed. Team-wide and self-attributed: any team member with
// culture access shares a win (no target) or recognizes a teammate. The author
// is always the poster (created_by = auth.uid()), so no one posts as someone else.
export async function addCultureMoment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get("kind") || "shoutout");
  const about = String(formData.get("about") || "").trim();
  const tag = String(formData.get("tag") || "");
  const valueId = String(formData.get("valueId") || "").trim();
  const message = String(formData.get("message") || "").trim();

  const isWin = kind === "win";
  if (!WIN_KIND_IDS.includes(kind as (typeof WIN_KIND_IDS)[number])) return { error: "Invalid post type." };
  if (!message) return { error: "Add a few words about it." };
  if (!isWin && !about) return { error: "Pick the teammate you're recognizing." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) === "none")
    return { error: "You don't have access to post here." };

  const supabase = await createClient();

  // Prefer tagging the org's own core value (recognition rolls up to the values
  // the owner defined). Fall back to the legacy generic tag when no value is
  // chosen (e.g. an org with no values yet). One of the two must be valid.
  let valueTag: string | null = null;
  let genericTag: string | null = null;
  if (valueId) {
    const { data: v } = await supabase.from("core_values").select("id").eq("id", valueId).eq("org_id", profile.orgId).maybeSingle();
    if (!v) return { error: "Pick a value." };
    valueTag = valueId;
  } else {
    if (!CULTURE_TAGS.includes(tag as (typeof CULTURE_TAGS)[number])) return { error: "Pick a value." };
    genericTag = tag;
  }

  const { error } = await supabase.from("culture_moments").insert({
    org_id: profile.orgId,
    author: profile.fullName || "A teammate",
    about: isWin ? "" : about,
    tag: genericTag,
    value_id: valueTag,
    kind: isWin ? "win" : "shoutout",
    message,
    created_by: profile.userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null };
}

// Celebrate / un-celebrate a win (one reaction per person per moment).
export async function toggleMomentReaction(momentId: string): Promise<{ error: string | null; reacted?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) === "none")
    return { error: "Not allowed." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("culture_moment_reactions")
    .select("moment_id")
    .eq("moment_id", momentId)
    .eq("user_id", profile.userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("culture_moment_reactions")
      .delete()
      .eq("moment_id", momentId)
      .eq("user_id", profile.userId);
    if (error) return { error: "Couldn't update that." };
    revalidatePath("/culture");
    revalidatePath("/dashboard");
    return { error: null, reacted: false };
  }

  const { error } = await supabase
    .from("culture_moment_reactions")
    .insert({ moment_id: momentId, user_id: profile.userId, org_id: profile.orgId });
  if (error) return { error: "Couldn't update that." };
  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null, reacted: true };
}

// Remove a win — your own, or any if you're a manager (moderation).
export async function deleteCultureMoment(id: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("culture_moments").delete().eq("id", id).eq("org_id", profile.orgId);
  if (error) return { error: "Couldn't remove that." };

  revalidatePath("/culture");
  revalidatePath("/dashboard");
  return { error: null };
}
