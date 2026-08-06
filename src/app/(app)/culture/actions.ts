"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CULTURE_TAGS } from "@/lib/constants";

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

export async function addCultureMoment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const author = String(formData.get("author") || "").trim();
  const about = String(formData.get("about") || "").trim();
  const tag = String(formData.get("tag") || "");
  const message = String(formData.get("message") || "").trim();

  if (!author || !about || !message) return { error: "All fields are required." };
  if (!CULTURE_TAGS.includes(tag as (typeof CULTURE_TAGS)[number])) {
    return { error: "Invalid tag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase.from("culture_moments").insert({
    org_id: org.id,
    author,
    about,
    tag,
    message,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/culture");
  return { error: null };
}
