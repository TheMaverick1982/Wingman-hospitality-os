import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_BUCKET, MAX_IMAGE_BYTES, MAX_IMAGES_PER_POST } from "@/lib/social";

// Server-only storage helpers for the social planner (upload / delete images).
// Kept separate from social.ts so the shared types/constants stay client-safe.

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "video/mp4", "video/quicktime"]);

// Validate + upload images to the public bucket. Returns stored paths or an error.
export async function uploadSocialImages(files: File[]): Promise<{ paths: string[]; error: string | null }> {
  const real = files.filter((f) => f && f.size > 0);
  if (real.length === 0) return { paths: [], error: null };
  if (real.length > MAX_IMAGES_PER_POST) return { paths: [], error: `Up to ${MAX_IMAGES_PER_POST} images per post.` };

  const admin = createAdminClient();
  const paths: string[] = [];
  for (const file of real) {
    if (file.size > MAX_IMAGE_BYTES) return { paths, error: `"${file.name}" is too large — 15MB max.` };
    if (!ALLOWED_TYPES.has(file.type)) return { paths, error: `"${file.name}": images or MP4 only.` };
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
    const path = `${randomUUID()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from(SOCIAL_BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
    if (error) return { paths, error: error.message };
    paths.push(path);
  }
  return { paths, error: null };
}

// Best-effort delete of image files from storage.
export async function deleteSocialImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  await admin.storage.from(SOCIAL_BUCKET).remove(paths);
}
