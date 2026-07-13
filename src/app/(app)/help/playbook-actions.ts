"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { consumeAiLimit } from "@/lib/rate-limit";

export type PlaybookArticle = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  updated_at: string;
};

export type PlaybookState = { error: string | null; id?: string };

export async function savePlaybookArticle(_prev: PlaybookState, formData: FormData): Promise<PlaybookState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can edit the team playbook." };
  }

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title) return { error: "Give the guide a title." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (body.length > 20000) return { error: "This guide is too long — keep it under 20,000 characters." };

  const supabase = await createClient();

  if (id) {
    // RLS guarantees this only updates the caller's own org.
    const { error } = await supabase.from("playbook_articles").update({ title, body, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/help");
    revalidatePath(`/help/playbook/${id}`);
    return { error: null, id };
  }

  const { data: last } = await supabase
    .from("playbook_articles")
    .select("sort_order")
    .eq("org_id", profile.orgId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("playbook_articles")
    .insert({ org_id: profile.orgId, title, body, sort_order: sortOrder, created_by: profile.userId })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/help");
  return { error: null, id: inserted.id };
}

export async function deletePlaybookArticle(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can delete a guide." };
  }
  if (!id) return { error: "Missing guide." };

  const supabase = await createClient();
  const { error } = await supabase.from("playbook_articles").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/help");
  return { error: null };
}

// ---------------------------------------------------------------------------
// AI drafting: write a guide from a short description, or improve/expand an
// existing one. Returns the guide body as plain text for the editor to fill in
// (the owner reviews and edits before saving) — no writes happen here.
// ---------------------------------------------------------------------------
function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

export async function draftPlaybookArticle(input: {
  instruction: string;
  title: string;
  currentBody: string;
}): Promise<{ error: string | null; body?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can use AI drafting." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const instruction = String(input.instruction || "").trim().slice(0, 2000);
  const title = String(input.title || "").trim().slice(0, 200);
  const currentBody = String(input.currentBody || "").trim().slice(0, 20000);
  if (!instruction && !currentBody) return { error: "Tell Wingman what the guide should cover." };

  const isImprove = currentBody.length > 0;
  const task = isImprove
    ? `Improve and expand the existing team guide below based on the owner's request. Keep what's good; fix, clarify, and add what's missing.

EXISTING GUIDE${title ? ` (title: "${title}")` : ""}:
"""
${currentBody}
"""

OWNER'S REQUEST: "${instruction || "Make it clearer, more complete, and well-organized."}"`
    : `Write a practical team guide / SOP for a restaurant${title ? ` titled "${title}"` : ""} based on the owner's request: "${instruction}"`;

  const prompt = `${task}

Format the guide as plain text a restaurant team can follow:
- Use "# " at the start of a line for a section heading.
- Use "- " at the start of a line for a bullet.
- Leave a blank line between paragraphs.
Do NOT use markdown bold, italics, tables, or code fences. Be concrete and specific to running a restaurant. Output ONLY the guide content — no preamble, no sign-off, no commentary.`;

  try {
    const response = await callAnthropic(apiKey, {
      model: "claude-sonnet-5",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    if (!response.ok) {
      const b = await response.text().catch(() => "");
      throw new Error(`Anthropic API returned ${response.status}: ${b.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    if (!text) return { error: "Wingman couldn't draft that — try rephrasing your request." };
    return { error: null, body: text.slice(0, 20000) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't draft the guide. Try again." };
  }
}
