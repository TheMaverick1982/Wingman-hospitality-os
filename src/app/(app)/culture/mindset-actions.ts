"use server";

import { createClient } from "@/lib/supabase/server";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";

export type MindsetState = { error: string | null; mindset?: string };

const SYSTEM = `You are an elite restaurant operator writing the "Owner's Mindset" — the short culture manifesto that sits at the heart of a restaurant's team app. It is addressed directly to the team ("you"), and its whole job is to make every staff member treat the place like they own it: as if their own savings were on the line, every guest is the reason the doors stay open, and every shift is their name on the sign.

${HOSPITALITY_DOCTRINE}

Write it warm, direct, and vivid — concrete images a line cook or a server feels, never generic corporate values. 2-3 short paragraphs. Output ONLY the manifesto text — no title, no markdown, no quotation marks, no preamble.`;

function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

// Generate an Owner's Mindset manifesto grounded in the restaurant's own
// philosophy + the hospitality doctrine. Returns a preview — nothing is saved
// until the owner hits Save (updateCultureText with field "owner_mindset").
export async function generateOwnerMindset(existing?: string): Promise<MindsetState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "culture", profile.permissionOverrides)) {
    return { error: "You don't have access to edit culture." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("name, philosophy, x_factor").single();
  const orgName = (org as { name?: string } | null)?.name ?? "the restaurant";
  const philosophy = (org as { philosophy?: string | null } | null)?.philosophy ?? "";
  const xFactor = (org as { x_factor?: string | null } | null)?.x_factor ?? "";

  const prompt = `Write the Owner's Mindset manifesto for ${orgName}.

${philosophy ? `The restaurant's philosophy (reflect its spirit): ${philosophy}\n` : ""}${xFactor ? `What makes them stand out: ${xFactor}\n` : ""}${existing?.trim() ? `Here is their current version — sharpen and improve it, keep what's good, make it hit harder:\n"""${existing.trim()}"""\n` : ""}
Anchor it in the "treat it like you own it / imagine your own money is on the line" frame. Output ONLY the manifesto text.`;

  try {
    const res = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "owner_mindset", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    const mindset = text.replace(/^["']+|["']+$/g, "").trim().slice(0, 2000);
    if (!mindset) throw new Error("The generator returned an empty response. Try again.");
    return { error: null, mindset };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed. Try again." };
  }
}
