"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const VALID_SECTIONS = ["culture", "bounceback", "recovery", "training", "accountability", "hiring", "growth"];

export async function scheduleReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const frequency = String(formData.get("frequency") || "");
  const sections = VALID_SECTIONS.filter((s) => formData.get(`section_${s}`) === "on");
  const recipients = String(formData.get("recipients") || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!["weekly", "biweekly", "monthly"].includes(frequency)) return { error: "Choose a frequency." };
  if (sections.length === 0) return { error: "Choose at least one section." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  // Recipients must be Manager or Super Admin per the design's permission
  // matrix. Emails aren't queryable from profiles (they live in
  // auth.users), so this gets enforced with the service role when the
  // actual send job is wired up, not at schedule-creation time.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("report_schedules").insert({
    org_id: org.id,
    frequency,
    sections,
    recipient_emails: recipients,
    created_by: user?.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/reporting");
  return { error: null };
}

export async function deleteReportSchedule(id: string) {
  const supabase = await createClient();
  await supabase.from("report_schedules").delete().eq("id", id);
  revalidatePath("/reporting");
}
