"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";

export type OpeningInput = {
  id?: string | null;
  department: string;
  locationId: string | null; // null = all locations
  title?: string;
  payNote?: string;
  employmentType?: string;
  adCopy: string;
};
export type OpeningResult = { error: string | null; id?: string; code?: string | null };
export type AdResult = { error: string | null; adCopy?: string };

function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

const SYSTEM = `You are an expert restaurant recruiter and copywriter. You write a job ad that will be posted on Indeed, Craigslist, and social — warm, specific, and honest, that attracts hospitality-minded people (not just anyone with a pulse). You cover what the role really is, the KIND of person who thrives in it, the core responsibilities, and a clear call to apply. You write in the restaurant's voice, never generic corporate filler.

${HOSPITALITY_DOCTRINE}

Output ONLY the ad copy as plain text (short paragraphs and simple bullet lines are fine). No markdown headers, no preamble, no "here's your ad".`;

// Generate a job ad for a role opening, grounded in the restaurant's own
// standards, duties, hiring criteria, and philosophy. Returns a preview only.
export async function generateOpeningAd(input: {
  department: string;
  locationId: string | null;
  payNote?: string;
  employmentType?: string;
  mustHaves?: string;
  existing?: string;
}): Promise<AdResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return { error: "You don't have access to hiring." };
  if (!ALL_DEPARTMENTS.includes(input.department as Department)) return { error: "Pick a role." };
  if (!(await consumeAiLimit(profile))) return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const [{ data: org }, { data: standards }, { data: duties }, { data: traits }, locRow] = await Promise.all([
    supabase.from("organizations").select("name, philosophy").single(),
    supabase.from("department_standards").select("item").eq("department", input.department).order("sort_order"),
    supabase.from("department_training_items").select("item").eq("department", input.department).order("sort_order"),
    supabase.from("hiring_traits").select("title, green_flag, red_flag").eq("department", input.department).order("sort_order"),
    input.locationId ? supabase.from("locations").select("name").eq("id", input.locationId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const orgName = (org as { name?: string } | null)?.name ?? "our restaurant";
  const philosophy = (org as { philosophy?: string | null } | null)?.philosophy ?? "";
  const locName = (locRow?.data as { name?: string } | null)?.name ?? null;
  const behaviorList = ((standards ?? []) as { item: string }[]).map((s) => `- ${s.item}`).join("\n");
  const dutyList = ((duties ?? []) as { item: string }[]).map((d) => `- ${d.item}`).join("\n");
  const traitList = ((traits ?? []) as { title: string; green_flag: string; red_flag: string }[])
    .map((t) => `- ${t.title}: we look for ${t.green_flag}; we avoid ${t.red_flag}`)
    .join("\n");

  const prompt = `Write a job ad to hire a ${input.department} at ${orgName}${locName ? ` (${locName} location)` : ""}. It will be posted on Indeed / Craigslist / social.

Cover, in the restaurant's own warm voice:
1. A short, inviting opener about the restaurant and why this role matters to the guest experience.
2. What the ${input.department} actually does day to day (the responsibilities).
3. The KIND of person who thrives here — the traits and mindset (not just experience).
4. ${input.payNote ? `Pay: ${input.payNote}. ` : ""}${input.employmentType ? `Type: ${input.employmentType}. ` : ""}A clear, friendly call to apply.

${philosophy ? `Restaurant philosophy (reflect its spirit): ${philosophy}\n` : ""}${behaviorList ? `The role's guest-experience standards:\n${behaviorList}\n` : ""}${dutyList ? `The role's responsibilities:\n${dutyList}\n` : ""}${traitList ? `Who we're looking for (hiring criteria):\n${traitList}\n` : ""}${input.mustHaves ? `Must-haves / specifics the owner wants included: ${input.mustHaves}\n` : ""}${input.existing ? `Start from this existing ad and improve it (keep the true details): ${input.existing}\n` : ""}
Keep it tight and scannable — this is a real posting, not an essay. Output ONLY the ad copy.`;

  try {
    const res = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "job_ad", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    const adCopy = text.replace(/^["']+|["']+$/g, "").trim().slice(0, 6000);
    if (!adCopy) throw new Error("The generator returned an empty response. Try again.");
    return { error: null, adCopy };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
}

// Create or update an opening. Admin client, scoped to the caller's org after the
// hiring auth check.
export async function saveOpening(input: OpeningInput): Promise<OpeningResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return { error: "Not authorized." };
  if (!ALL_DEPARTMENTS.includes(input.department as Department)) return { error: "Pick a role." };

  const admin = createAdminClient();
  const row = {
    department: input.department,
    location_id: input.locationId || null,
    title: input.title?.trim() || null,
    ad_copy: input.adCopy?.trim() || "",
    pay_note: input.payNote?.trim() || null,
    employment_type: input.employmentType?.trim() || null,
  };

  if (input.id) {
    const { error } = await admin.from("job_openings").update(row).eq("id", input.id).eq("org_id", profile.orgId);
    if (error) return { error: error.message };
    revalidatePath("/hiring");
    return { error: null, id: input.id };
  }

  const { data, error } = await admin
    .from("job_openings")
    .insert({ ...row, org_id: profile.orgId, created_by: profile.userId })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the opening." };
  const newId = (data as { id: string }).id;

  // Assign a unique short code for the /j/<code> link. Best-effort with a retry
  // on the (astronomically rare) collision; if the code column isn't there yet
  // (migration lag) it just stays null and the opening falls back to its full
  // apply link.
  let assignedCode: string | null = null;
  for (let i = 0; i < 5; i++) {
    const candidate = randomBytes(5).toString("hex").slice(0, 7);
    const { error: codeErr } = await admin
      .from("job_openings")
      .update({ code: candidate })
      .eq("id", newId)
      .eq("org_id", profile.orgId)
      .is("code", null);
    if (!codeErr) {
      assignedCode = candidate;
      break;
    }
  }

  revalidatePath("/hiring");
  return { error: null, id: newId, code: assignedCode };
}

export async function setOpeningStatus(id: string, status: "open" | "closed"): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("job_openings")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function deleteOpening(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "hiring", profile.permissionOverrides)) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin.from("job_openings").delete().eq("id", id).eq("org_id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}
