"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { CULTURE_TAGS } from "@/lib/constants";
import { WIN_KIND_IDS } from "@/lib/wins";

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

// Post to the Wins feed. Team-wide and self-attributed: any team member with
// culture access shares a win (no target) or recognizes a teammate. The author
// is always the poster (created_by = auth.uid()), so no one posts as someone else.
export async function addCultureMoment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get("kind") || "shoutout");
  const about = String(formData.get("about") || "").trim();
  const tag = String(formData.get("tag") || "");
  const message = String(formData.get("message") || "").trim();

  const isWin = kind === "win";
  if (!WIN_KIND_IDS.includes(kind as (typeof WIN_KIND_IDS)[number])) return { error: "Invalid post type." };
  if (!message) return { error: "Add a few words about it." };
  if (!isWin && !about) return { error: "Pick the teammate you're recognizing." };
  if (!CULTURE_TAGS.includes(tag as (typeof CULTURE_TAGS)[number])) return { error: "Invalid tag." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) === "none")
    return { error: "You don't have access to post here." };

  const supabase = await createClient();
  const { error } = await supabase.from("culture_moments").insert({
    org_id: profile.orgId,
    author: profile.fullName || "A teammate",
    about: isWin ? "" : about,
    tag,
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
