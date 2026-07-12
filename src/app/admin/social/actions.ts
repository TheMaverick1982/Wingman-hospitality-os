"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_PLATFORMS, SOCIAL_FORMATS, isAssistedOnly, type SocialPlatform, type SocialFormat, type SocialPost } from "@/lib/social";
import { uploadSocialImages, deleteSocialImages, createSocialUploadTargets } from "@/lib/social-storage";
import { getSocialSettings } from "@/lib/social-meta";
import { publishAll, anyConnected } from "@/lib/social-publish";

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

// Disconnect LinkedIn (clears the stored member token).
export async function disconnectLinkedIn(): Promise<void> {
  if (!(await guard())) return;
  const admin = createAdminClient();
  await admin
    .from("social_settings")
    .update({
      li_member_id: null,
      li_member_name: null,
      li_access_token: null,
      li_token_expires_at: null,
      li_connected_at: null,
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
  if (!settings || !anyConnected(settings)) return;

  const { data } = await admin.from("social_posts").select("*").eq("id", id).maybeSingle();
  const post = data as SocialPost | null;
  if (!post) return;
  if (isAssistedOnly(post.format)) return; // stories are posted by hand

  const now = new Date().toISOString();
  const outcome = await publishAll(post, settings);
  const publishedUrls = {
    ...(post.published_urls ?? {}),
    ...(outcome.facebook ? { facebook: outcome.facebook } : {}),
    ...(outcome.instagram ? { instagram: outcome.instagram } : {}),
    ...(outcome.linkedin ? { linkedin: outcome.linkedin } : {}),
  };
  const anyLive = Boolean(outcome.facebook || outcome.instagram || outcome.linkedin);

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
const VALID_FORMATS = new Set(SOCIAL_FORMATS.map((f) => f.key));

function parseFormat(formData: FormData): SocialFormat {
  const f = String(formData.get("format") || "feed");
  return (VALID_FORMATS.has(f as SocialFormat) ? f : "feed") as SocialFormat;
}

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
  const format = parseFormat(formData);
  const scheduledAt = parseScheduledAt(String(formData.get("scheduled_at") || ""));
  const intent = String(formData.get("intent") || "");
  const schedule = intent === "schedule";
  // Stories can't be auto-published, so "Post now" on a story just saves it.
  const publishNow = intent === "publish" && !isAssistedOnly(format);

  if (!caption && !formData.getAll("images").some((f) => f instanceof File && f.size > 0)) {
    return { error: "Add a caption or an image.", ok: false };
  }
  if (platforms.length === 0) return { error: "Pick at least one platform.", ok: false };
  if (schedule && !scheduledAt) return { error: "Set a date & time to schedule.", ok: false };

  const admin = createAdminClient();

  // "Post now" needs a connected platform up front.
  const settings = publishNow ? await getSocialSettings() : null;
  if (publishNow && (!settings || !anyConnected(settings))) {
    return { error: "Connect a platform before posting now.", ok: false };
  }

  // Upload any newly attached images and append to the existing ones.
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);
  const { paths: newPaths, error: upErr } = await uploadSocialImages(files);
  if (upErr) return { error: upErr, ok: false };

  const status = schedule ? "scheduled" : "draft";
  const nowIso = new Date().toISOString();
  let savedId = id;
  let image_paths = newPaths;

  if (id) {
    const { data: existing } = await admin.from("social_posts").select("image_paths").eq("id", id).maybeSingle();
    const prevPaths = (existing as { image_paths: string[] } | null)?.image_paths ?? [];
    // Images the user removed in the editor (kept_image = the ones to keep).
    const kept = formData.getAll("kept_image").map(String);
    const removed = prevPaths.filter((p) => !kept.includes(p));
    if (removed.length) await deleteSocialImages(removed);
    image_paths = [...prevPaths.filter((p) => kept.includes(p)), ...newPaths];
    const { error } = await admin
      .from("social_posts")
      .update({ caption, link, first_comment: firstComment, platforms, format, scheduled_at: scheduledAt, status, image_paths, updated_at: nowIso })
      .eq("id", id);
    if (error) return { error: error.message, ok: false };
  } else {
    const { data: created, error } = await admin
      .from("social_posts")
      .insert({ caption, link, first_comment: firstComment, platforms, format, scheduled_at: scheduledAt, status, image_paths: newPaths })
      .select("id")
      .single();
    if (error) return { error: error.message, ok: false };
    savedId = (created as { id: string } | null)?.id ?? "";
  }

  // Publish immediately if requested.
  if (publishNow && settings && savedId) {
    const post = {
      id: savedId,
      format,
      platforms,
      caption,
      link,
      first_comment: firstComment,
      image_paths,
      published_urls: {},
    } as unknown as SocialPost;
    const outcome = await publishAll(post, settings);
    const anyLive = Boolean(outcome.facebook || outcome.instagram || outcome.linkedin);
    const publishedUrls = {
      ...(outcome.facebook ? { facebook: outcome.facebook } : {}),
      ...(outcome.instagram ? { instagram: outcome.instagram } : {}),
      ...(outcome.linkedin ? { linkedin: outcome.linkedin } : {}),
    };
    await admin
      .from("social_posts")
      .update({
        status: anyLive && !outcome.error ? "posted" : status,
        posted_at: anyLive && !outcome.error ? nowIso : null,
        published_urls: publishedUrls,
        publish_error: outcome.error ?? null,
        last_publish_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", savedId);
    revalidatePath("/admin/social");
    if (outcome.error) return { error: `Published with issues — ${outcome.error}`, ok: true };
    return { error: null, ok: true };
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
  format?: string; // feed | reel | story
  scheduled_at?: string;
  image?: string; // single image/video filename
  images?: string[]; // or several (carousel), in order
};

// Issue signed upload targets so the browser can push image files DIRECTLY to
// storage (bypassing Vercel's 4.5MB server-request cap). Called before import.
export async function signSocialUploads(names: string[]): Promise<{ name: string; path: string; token: string }[]> {
  if (!(await guard())) return [];
  const clean = names.map((n) => String(n)).filter(Boolean);
  if (clean.length === 0) return [];
  return createSocialUploadTargets(clean);
}

// Create the posts from the JSON plan, attaching images that were already
// uploaded to storage from the browser. `pathsJson` maps lowercased filename →
// storage path (built client-side from the signed uploads).
export async function importPosts(json: string, pathsJson: string): Promise<SocialFormState> {
  if (!(await guard())) return { error: "Not authorized.", ok: false };
  const raw = String(json || "").trim();
  if (!raw) return { error: "Paste a JSON plan first.", ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "That isn't valid JSON. Paste an array of posts.", ok: false };
  }
  const items = (Array.isArray(parsed) ? parsed : (parsed as { posts?: unknown[] })?.posts) as ImportedPost[] | undefined;
  if (!Array.isArray(items) || items.length === 0) return { error: "No posts found in the JSON.", ok: false };

  let pathMap: Record<string, string> = {};
  try {
    pathMap = pathsJson ? (JSON.parse(pathsJson) as Record<string, string>) : {};
  } catch {
    pathMap = {};
  }
  const missing = new Set<string>();

  const rows: Record<string, unknown>[] = items.slice(0, 200).map((p) => {
    const platforms = Array.isArray(p.platforms) ? p.platforms.filter((x) => VALID_PLATFORMS.has(x as SocialPlatform)) : [];
    const format = p.format && VALID_FORMATS.has(p.format as SocialFormat) ? p.format : "feed";
    const scheduled_at = p.scheduled_at ? parseScheduledAt(String(p.scheduled_at)) : null;

    // Resolve referenced filenames → uploaded storage paths (preserving order).
    const names: string[] = [];
    if (typeof p.image === "string" && p.image.trim()) names.push(p.image.trim());
    if (Array.isArray(p.images)) for (const n of p.images) if (typeof n === "string" && n.trim()) names.push(n.trim());
    const image_paths: string[] = [];
    for (const n of names) {
      const path = pathMap[n.toLowerCase()];
      if (path) image_paths.push(path);
      else missing.add(n);
    }

    return {
      caption: String(p.caption ?? "").trim(),
      link: p.link ? String(p.link).trim() : null,
      first_comment: p.first_comment ? String(p.first_comment).trim() : null,
      platforms: platforms.length ? platforms : SOCIAL_PLATFORMS.map((x) => x.key),
      format,
      scheduled_at,
      image_paths,
      // Imported with a time → scheduled; without → draft to fill in.
      status: scheduled_at ? "scheduled" : "draft",
    };
  });

  const admin = createAdminClient();
  const { error } = await admin.from("social_posts").insert(rows);
  if (error) return { error: error.message, ok: false };

  revalidatePath("/admin/social");
  const warn = missing.size ? ` (couldn't find ${missing.size} image${missing.size === 1 ? "" : "s"}: ${[...missing].slice(0, 5).join(", ")} — add them to those posts manually)` : "";
  return { error: warn ? warn.trim() : null, ok: true };
}
