// Social content planner (Phase 1) — shared types + constants. Client-safe (no
// server-only imports); storage helpers live in social-storage.ts.

export const SOCIAL_BUCKET = "social-media";
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50MB (covers short reel videos)
export const MAX_IMAGES_PER_POST = 10;
// Delete post images from storage this many days after they're posted (they're
// already live on the platform by then; keeps the record, frees the bytes).
// A post that failed to publish is never purged, so a Retry still has its image.
export const IMAGE_RETENTION_DAYS = 3;

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["key"];

export const SOCIAL_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "posted", label: "Posted" },
  { key: "skipped", label: "Skipped" },
] as const;
export type SocialStatus = (typeof SOCIAL_STATUSES)[number]["key"];

export const SOCIAL_FORMATS = [
  { key: "feed", label: "Feed post" },
  { key: "reel", label: "Reel (video)" },
  { key: "story", label: "Story" },
] as const;
export type SocialFormat = (typeof SOCIAL_FORMATS)[number]["key"];

// Stories can't be auto-published (the API can't add a link sticker), so they're
// always posted by hand from a reminder.
export function isAssistedOnly(format: string): boolean {
  return format === "story";
}

export const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;
export function isVideoPath(p: string): boolean {
  return VIDEO_EXT.test(p);
}

export type SocialPost = {
  id: string;
  format: SocialFormat;
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
