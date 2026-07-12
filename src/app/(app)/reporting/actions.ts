"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { consumeAiLimit } from "@/lib/rate-limit";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";

export type ActionState = { error: string | null };

export type NarrativeState = { error: string | null; text: string | null };

// Turn the report's numbers into a short operator briefing: what's moving, what's
// slipping, and the one thing to focus on this week. The page passes a compact
// JSON snapshot of the already-computed metrics so we don't re-query here.
export async function generateReportNarrative(_prev: NarrativeState, formData: FormData): Promise<NarrativeState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're not signed in.", text: null };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI. Please try again a bit later.", text: null };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY isn't configured yet.", text: null };

  const snapshot = String(formData.get("snapshot") || "").slice(0, 4000);
  if (!snapshot) return { error: "No report data to summarize.", text: null };

  const prompt = `Here is a restaurant's Wingman report data as JSON:
${snapshot}

Write a short briefing for the owner — plain, specific, and useful. Structure it as:
1. One line on what's moving in the RIGHT direction (name the number).
2. One line on what's SLIPPING or needs attention (name the number).
3. "This week: " then THE ONE highest-leverage thing to do, tied to the data.

Keep it under 90 words total. No greeting, no fluff, no restating every metric — an owner should read it in 15 seconds and know exactly what to do. Reference specifics (a month, a stage, a server) where the data supports it.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system: `You are an elite hospitality operator reading a restaurant's weekly numbers and telling the owner what matters. You are direct, specific, and never generic.

${HOSPITALITY_DOCTRINE}`,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API returned ${response.status}`);
    const data = await response.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
    if (!text) throw new Error("The summary came back empty. Try again.");
    return { error: null, text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate the summary. Try again.", text: null };
  }
}

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
