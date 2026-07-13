"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email";
import type { IdeaStatus } from "@/lib/feature-ideas";

const ALERT_TO = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
const VALID_STATUS: IdeaStatus[] = ["open", "planned", "in_progress", "shipped", "declined"];

export type SubmitIdeaState = { error: string | null; ok?: boolean };

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

export async function submitIdea(_prev: SubmitIdeaState, formData: FormData): Promise<SubmitIdeaState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const title = String(formData.get("title") || "").trim().slice(0, 140);
  const details = String(formData.get("details") || "").trim().slice(0, 2000);
  if (!title) return { error: "Give your idea a short title." };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("feature_ideas")
    .insert({ org_id: profile.orgId, submitted_by: profile.userId, title, details })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Auto-upvote your own idea, so it starts at 1 and you can't double-count it.
  await supabase.from("feature_idea_votes").insert({ idea_id: (created as { id: string }).id, profile_id: profile.userId });

  // Alert the founder (internal — includes the org for follow-up; the public
  // board never shows who submitted). Best-effort.
  void alertNewIdea(title, details, profile.orgName || "a customer");

  revalidatePath("/features");
  return { error: null, ok: true };
}

async function alertNewIdea(title: string, details: string, orgName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:600px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0a6cff;margin:0 0 6px;">New feature idea</p>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;">${esc(title)}</h1>
    ${details ? `<p style="font-size:14.5px;color:#525252;white-space:pre-wrap;margin:0 0 14px;">${esc(details)}</p>` : ""}
    <p style="font-size:13px;color:#737373;margin:0 0 16px;">From ${esc(orgName)}. It's live on the <a href="${SITE}/features" style="color:#0a6cff;">Feature Ideas board</a> for others to vote on.</p>
  </div>`;
  try {
    await sendEmail({ to: [ALERT_TO], subject: `💡 New feature idea: ${title.slice(0, 80)}`, html });
  } catch (e) {
    console.error("[features] alert failed", e);
  }
}

// Toggle the current user's vote on an idea (one vote per person).
export async function toggleVote(ideaId: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("feature_idea_votes")
    .select("id")
    .eq("idea_id", ideaId)
    .eq("profile_id", profile.userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("feature_idea_votes").delete().eq("id", (existing as { id: string }).id);
  } else {
    await supabase.from("feature_idea_votes").insert({ idea_id: ideaId, profile_id: profile.userId });
  }
  revalidatePath("/features");
  return { error: null };
}

// Platform staff set an idea's status (Planned / Shipped / …) — via the
// service-role client, since regular users can't update others' ideas.
export async function setIdeaStatus(ideaId: string, status: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return { error: "Not authorized." };
  if (!VALID_STATUS.includes(status as IdeaStatus)) return { error: "Invalid status." };

  const admin = createAdminClient();
  await admin.from("feature_ideas").update({ status, updated_at: new Date().toISOString() }).eq("id", ideaId);
  revalidatePath("/features");
  return { error: null };
}
