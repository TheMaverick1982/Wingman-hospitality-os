"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_PLATFORMS, type SocialPlatform, type SocialPost } from "@/lib/social";
import { uploadSocialImages, deleteSocialImages } from "@/lib/social-storage";
import { getSocialSettings, isConnected, publishPost } from "@/lib/social-meta";

async function guard() {
  return platformSectionActor("social");
}

// Turn auto-publish on/off (publishes scheduled posts automatically at their time).
export async function setAutoPublish(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const on = String(formData.get("on") || "") === "true";
  const admin = createAdminClient();
  await admin.from("social_settings").update({ auto_publish: on, updated_at: new Date().toISOString() }).eq("id", 1);
  revalidatePath("/admin/social");
}

// Disconnect the Meta account (clears the stored token + Page/IG link).
export async function disconnectMeta(): Promise<void> {
  if (!(await guard())) return;
  const admin = createAdminClient();
  await admin
    .from("social_settings")
    .update({
      fb_page_id: null,
      fb_page_name: null,
      page_access_token: null,
      ig_user_id: null,
      ig_username: null,
      token_expires_at: null,
      auto_publish: false,
      connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  revalidatePath("/admin/social");
}

// Publish (or retry) a single post right now.
export async function publishNow(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const admin = createAdminClient();
  const settings = await getSocialSettings();
  if (!isConnected(settings) || !settings) return;

  const { data } = await admin.from("social_posts").select("*").eq("id", id).maybeSingle();
  const post = data as SocialPost | null;
  if (!post) return;

  const now = new Date().toISOString();
  const outcome = await publishPost(post, settings);
  const publishedUrls = { ...(post.published_urls ?? {}), ...(outcome.facebook ? { facebook: outcome.facebook } : {}), ...(outcome.instagram ? { instagram: outcome.instagram } : {}) };
  const anyLive = Boolean(outcome.facebook || outcome.instagram);

  await admin
    .from("social_posts")
    .update({
      status: anyLive && !outcome.error ? "posted" : post.status,
      posted_at: anyLive && !outcome.error ? now : post.posted_at,
      published_urls: publishedUrls,
      publish_error: outcome.error ?? null,
      last_publish_at: now,
      updated_at: now,
    })
    .eq("id", id);
  revalidatePath("/admin/social");
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

type ImportedPost = {
  caption?: string;
  link?: string;
  first_comment?: string;
  platforms?: string[];
  scheduled_at?: string;
  image?: string; // single image filename
  images?: string[]; // or several (carousel), in order
};

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

  // Map uploaded image files by filename (case-insensitive) so each post's
  // "image"/"images" field can pull in the right graphics.
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const byName = new Map<string, File>();
  for (const f of files) byName.set(f.name.toLowerCase().trim(), f);
  const missing = new Set<string>();

  const admin = createAdminClient();
  const rows: Record<string, unknown>[] = [];

  for (const p of items.slice(0, 200)) {
    const platforms = Array.isArray(p.platforms) ? p.platforms.filter((x) => VALID_PLATFORMS.has(x as SocialPlatform)) : [];
    const scheduled_at = p.scheduled_at ? parseScheduledAt(String(p.scheduled_at)) : null;

    // Resolve referenced filenames → uploaded files (preserving order).
    const names: string[] = [];
    if (typeof p.image === "string" && p.image.trim()) names.push(p.image.trim());
    if (Array.isArray(p.images)) for (const n of p.images) if (typeof n === "string" && n.trim()) names.push(n.trim());
    const matched: File[] = [];
    for (const n of names) {
      const f = byName.get(n.toLowerCase());
      if (f) matched.push(f);
      else missing.add(n);
    }

    let image_paths: string[] = [];
    if (matched.length) {
      const { paths, error } = await uploadSocialImages(matched);
      if (error) return { error: `Image upload failed: ${error}`, ok: false };
      image_paths = paths;
    }

    rows.push({
      caption: String(p.caption ?? "").trim(),
      link: p.link ? String(p.link).trim() : null,
      first_comment: p.first_comment ? String(p.first_comment).trim() : null,
      platforms: platforms.length ? platforms : SOCIAL_PLATFORMS.map((x) => x.key),
      scheduled_at,
      image_paths,
      // Imported with a time → scheduled; without → draft to fill in.
      status: scheduled_at ? "scheduled" : "draft",
    });
  }

  const { error } = await admin.from("social_posts").insert(rows);
  if (error) return { error: error.message, ok: false };

  revalidatePath("/admin/social");
  // Flag any referenced images that weren't among the uploaded files.
  const warn = missing.size ? ` (couldn't find ${missing.size} image${missing.size === 1 ? "" : "s"}: ${[...missing].slice(0, 5).join(", ")} — add them to those posts manually)` : "";
  return { error: warn ? warn.trim() : null, ok: true };
}
