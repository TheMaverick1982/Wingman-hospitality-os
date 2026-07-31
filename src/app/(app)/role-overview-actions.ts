"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import type { CurrentProfile } from "@/lib/auth/profile";

export type RoleOverviewState = { error: string | null; overview?: string };

// Editing role content is a Training/Hiring capability — a manager who can shape
// either can write the role overview.
function canEditRoles(profile: CurrentProfile): boolean {
  return (
    canEditSection(profile.accessRole, "training", profile.permissionOverrides) ||
    canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)
  );
}

function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

const SYSTEM = `You are an elite restaurant operations writer. You write a SHORT role overview addressed directly to the person in a role ("you"), that sits at the top of their role guide. It frames what the role is really about and the mindset that makes someone great at it — warm, motivating, and concrete, never generic corporate filler.

${HOSPITALITY_DOCTRINE}

You output ONLY the overview text — no title, no markdown, no quotation marks, no preamble.`;

// Generate a role overview grounded in the restaurant's own philosophy and the
// role's standards + duties. Returns a preview — nothing is saved until save*().
export async function generateRoleOverview(department: string): Promise<RoleOverviewState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditRoles(profile)) return { error: "You don't have access to edit roles." };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const [{ data: org }, { data: standards }, { data: duties }] = await Promise.all([
    supabase.from("organizations").select("name, philosophy").single(),
    supabase.from("department_standards").select("item").eq("department", department).order("sort_order"),
    supabase.from("department_training_items").select("item").eq("department", department).order("sort_order"),
  ]);
  const orgName = (org as { name?: string } | null)?.name ?? "the restaurant";
  const philosophy = (org as { philosophy?: string | null } | null)?.philosophy ?? "";
  const behaviorList = ((standards ?? []) as { item: string }[]).map((s) => `- ${s.item}`).join("\n");
  const dutyList = ((duties ?? []) as { item: string }[]).map((d) => `- ${d.item}`).join("\n");

  const prompt = `Write a role overview for the ${department} role at ${orgName}, addressed TO the person in that role ("you"). It appears at the top of their role guide, above their guest-experience standards and their responsibilities.

Write 2-3 sentences: what this role is really about, why it matters to the guest experience, and the mindset that makes someone great at it. Warm and motivating, but specific to this role — not generic. Do NOT restate the individual standards or duties (those are listed right below it).

${philosophy ? `The restaurant's philosophy (reflect its spirit): ${philosophy}\n` : ""}${behaviorList ? `The role's guest-experience standards (context only — don't just repeat them):\n${behaviorList}\n` : ""}${dutyList ? `The role's responsibilities (context only):\n${dutyList}\n` : ""}
Output ONLY the overview text.`;

  try {
    const res = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "role_overview", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    const overview = text.replace(/^["']+|["']+$/g, "").trim().slice(0, 1000);
    if (!overview) throw new Error("The generator returned an empty response. Try again.");
    return { error: null, overview };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
}

// Persist the overview onto the org's department_meta row. Admin client, scoped
// explicitly to the caller's org, after the manager auth check above.
export async function saveRoleOverview(department: string, overview: string): Promise<RoleOverviewState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditRoles(profile)) return { error: "Not authorized." };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role." };

  const clean = overview.trim().slice(0, 1000);
  const admin = createAdminClient();
  const { error } = await admin
    .from("department_meta")
    .update({ description: clean || null })
    .eq("org_id", profile.orgId)
    .eq("department", department);
  if (error) return { error: error.message };
  revalidatePath("/my-role");
  return { error: null, overview: clean };
}
