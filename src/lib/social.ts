// Social content planner (Phase 1) — shared types + constants. Client-safe (no
// server-only imports); storage helpers live in social-storage.ts.

export const SOCIAL_BUCKET = "social-media";
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_IMAGES_PER_POST = 10;
// Delete post images from storage this many days after they're posted (they're
// already live on the platform by then; keeps the record, frees the bytes).
export const IMAGE_RETENTION_DAYS = 14;

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["key"];

export const SOCIAL_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "posted", label: "Posted" },
  { key: "skipped", label: "Skipped" },
] as const;
export type SocialStatus = (typeof SOCIAL_STATUSES)[number]["key"];

export type SocialPost = {
  id: string;
  platforms: string[];
  caption: string;
  link: string | null;
  first_comment: string | null;
  image_paths: string[];
  scheduled_at: string | null;
  status: SocialStatus;
  posted_at: string | null;
  reminder_sent_at: string | null;
  images_purged_at: string | null;
  published_urls: Record<string, string> | null;
  publish_error: string | null;
  last_publish_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Public URL for a stored image (public bucket — no signing needed). Client-safe:
// NEXT_PUBLIC_SUPABASE_URL is available in the browser too.
export function publicImageUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${SOCIAL_BUCKET}/${path}`;
}
