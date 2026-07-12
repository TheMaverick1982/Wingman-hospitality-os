import "server-only";
import type { SocialPost } from "@/lib/social";
import { publishPost, isConnected, type SocialSettings } from "@/lib/social-meta";
import { publishLinkedIn, isLinkedInConnected } from "@/lib/social-linkedin";

// Unified publisher across every connected platform a post targets. Best-effort
// per platform: one failing doesn't block the others; errors are collected.
export type PublishOutcome = { facebook?: string; instagram?: string; linkedin?: string; error?: string };

// True if any platform is connected (Meta and/or LinkedIn).
export function anyConnected(s: SocialSettings | null): boolean {
  return isConnected(s) || isLinkedInConnected(s);
}

export async function publishAll(post: SocialPost, s: SocialSettings): Promise<PublishOutcome> {
  const out: PublishOutcome = {};
  const errors: string[] = [];

  // Facebook + Instagram (only acts on the platforms the post targets).
  const meta = await publishPost(post, s);
  if (meta.facebook) out.facebook = meta.facebook;
  if (meta.instagram) out.instagram = meta.instagram;
  if (meta.error) errors.push(meta.error);

  // LinkedIn.
  if (post.platforms.includes("linkedin") && isLinkedInConnected(s)) {
    const li = await publishLinkedIn(post, s);
    if (li.error) errors.push(`LinkedIn: ${li.error}`);
    else out.linkedin = li.url;
  }

  if (errors.length) out.error = errors.join(" · ");
  return out;
}
