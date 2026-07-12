"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social";
import { uploadSocialImages, deleteSocialImages } from "@/lib/social-storage";

async function guard() {
  return platformSectionActor("social");
}

const VALID_PLATFORMS = new Set(SOCIAL_PLATFORMS.map((p) => p.key));

export type SocialFormState = { error: string | null; ok: boolean };

function parsePlatforms(formData: FormData): string[] {
  return formData.getAll("platforms").map(String).filter((p) => VALID_PLATFORMS.has(p as SocialPlatform));
}

function parseScheduledAt(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function savePost(_prev: SocialFormState, formData: FormData): Promise<SocialFormState> {
  if (!(await guard())) return { error: "Not authorized.", ok: false };

  const id = String(formData.get("id") || "");
  const caption = String(formData.get("caption") || "").trim();
  const link = String(formData.get("link") || "").trim() || null;
  const firstComment = String(formData.get("first_comment") || "").trim() || null;
  const platforms = parsePlatforms(formData);
  const scheduledAt = parseScheduledAt(String(formData.get("scheduled_at") || ""));
  const schedule = String(formData.get("intent") || "") === "schedule";

  if (!caption && !formData.getAll("images").some((f) => f instanceof File && f.size > 0)) {
    return { error: "Add a caption or an image.", ok: false };
  }
  if (platforms.length === 0) return { error: "Pick at least one platform.", ok: false };
  if (schedule && !scheduledAt) return { error: "Set a date & time to schedule.", ok: false };

  const admin = createAdminClient();

  // Upload any newly attached images and append to the existing ones.
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);
  const { paths: newPaths, error: upErr } = await uploadSocialImages(files);
  if (upErr) return { error: upErr, ok: false };

  const status = schedule ? "scheduled" : "draft";
  const nowIso = new Date().toISOString();

  if (id) {
    const { data: existing } = await admin.from("social_posts").select("image_paths").eq("id", id).maybeSingle();
    const prevPaths = (existing as { image_paths: string[] } | null)?.image_paths ?? [];
    // Images the user removed in the editor (kept_image = the ones to keep).
    const kept = formData.getAll("kept_image").map(String);
    const removed = prevPaths.filter((p) => !kept.includes(p));
    if (removed.length) await deleteSocialImages(removed);
    const image_paths = [...prevPaths.filter((p) => kept.includes(p)), ...newPaths];
    const { error } = await admin
      .from("social_posts")
      .update({ caption, link, first_comment: firstComment, platforms, scheduled_at: scheduledAt, status, image_paths, updated_at: nowIso })
      .eq("id", id);
    if (error) return { error: error.message, ok: false };
  } else {
    const { error } = await admin
      .from("social_posts")
      .insert({ caption, link, first_comment: firstComment, platforms, scheduled_at: scheduledAt, status, image_paths: newPaths });
    if (error) return { error: error.message, ok: false };
  }

  revalidatePath("/admin/social");
  return { error: null, ok: true };
}

export async function markPosted(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const now = new Date().toISOString();
  const admin = createAdminClient();
  await admin.from("social_posts").update({ status: "posted", posted_at: now, updated_at: now }).eq("id", id);
  revalidatePath("/admin/social");
}

export async function setStatus(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["draft", "scheduled", "skipped"].includes(status)) return;
  const admin = createAdminClient();
  await admin.from("social_posts").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/social");
}

export async function deletePost(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const admin = createAdminClient();
  const { data } = await admin.from("social_posts").select("image_paths").eq("id", id).maybeSingle();
  const paths = (data as { image_paths: string[] } | null)?.image_paths ?? [];
  if (paths.length) await deleteSocialImages(paths);
  await admin.from("social_posts").delete().eq("id", id);
  revalidatePath("/admin/social");
}

type ImportedPost = { caption?: string; link?: string; first_comment?: string; platforms?: string[]; scheduled_at?: string };

export async function importPosts(_prev: SocialFormState, formData: FormData): Promise<SocialFormState> {
  if (!(await guard())) return { error: "Not authorized.", ok: false };
  const raw = String(formData.get("json") || "").trim();
  if (!raw) return { error: "Paste a JSON plan first.", ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "That isn't valid JSON. Paste an array of posts.", ok: false };
  }
  const items = (Array.isArray(parsed) ? parsed : (parsed as { posts?: unknown[] })?.posts) as ImportedPost[] | undefined;
  if (!Array.isArray(items) || items.length === 0) return { error: "No posts found in the JSON.", ok: false };

  const rows = items.slice(0, 200).map((p) => {
    const platforms = Array.isArray(p.platforms) ? p.platforms.filter((x) => VALID_PLATFORMS.has(x as SocialPlatform)) : [];
    const scheduled_at = p.scheduled_at ? parseScheduledAt(String(p.scheduled_at)) : null;
    return {
      caption: String(p.caption ?? "").trim(),
      link: p.link ? String(p.link).trim() : null,
      first_comment: p.first_comment ? String(p.first_comment).trim() : null,
      platforms: platforms.length ? platforms : SOCIAL_PLATFORMS.map((x) => x.key),
      scheduled_at,
      // Imported with a time → scheduled; without → draft to fill in.
      status: scheduled_at ? "scheduled" : "draft",
    };
  });

  const admin = createAdminClient();
  const { error } = await admin.from("social_posts").insert(rows);
  if (error) return { error: error.message, ok: false };

  revalidatePath("/admin/social");
  return { error: null, ok: true };
}
