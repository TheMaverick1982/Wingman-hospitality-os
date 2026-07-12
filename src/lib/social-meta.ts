import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl, type SocialPost } from "@/lib/social";

// Meta (Facebook + Instagram) Graph API integration for auto-publishing. All
// tokens live in social_settings (deny-all RLS) and never reach the client.

export const GRAPH = "https://graph.facebook.com/v21.0";
const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;

export const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export type SocialSettings = {
  fb_page_id: string | null;
  fb_page_name: string | null;
  page_access_token: string | null;
  ig_user_id: string | null;
  ig_username: string | null;
  token_expires_at: string | null;
  auto_publish: boolean;
  connected_at: string | null;
};

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
}
export function redirectUri(): string {
  return `${siteUrl()}/api/social/meta/callback`;
}
export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export async function getSocialSettings(): Promise<SocialSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("social_settings").select("*").eq("id", 1).maybeSingle();
  return (data as SocialSettings) ?? null;
}

export function isConnected(s: SocialSettings | null): boolean {
  return Boolean(s?.page_access_token && s?.fb_page_id);
}

// --- Graph helpers -----------------------------------------------------------

type GraphResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

async function graph(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<GraphResult> {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams(params);
  try {
    const res =
      method === "GET"
        ? await fetch(`${url.toString()}?${body.toString()}`)
        : await fetch(url.toString(), { method: "POST", body });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || json.error) {
      const err = json.error as { message?: string } | undefined;
      return { ok: false, error: err?.message ?? `Graph API error (${res.status})` };
    }
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- OAuth connect -----------------------------------------------------------

export function authDialogUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri(),
    state,
    scope: OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${p.toString()}`;
}

// Exchange the OAuth code → long-lived user token → the Page (+ its token) and
// the linked IG account. Persists everything to social_settings.
export async function completeOAuth(code: string, connectedBy: string): Promise<{ error: string | null; pageName?: string }> {
  const appId = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";

  // 1. Code → short-lived user token.
  const tok = await graph("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri(),
    code,
  });
  if (!tok.ok) return { error: tok.error };
  const shortToken = String(tok.data.access_token ?? "");

  // 2. Short-lived → long-lived user token (~60 days).
  const long = await graph("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  if (!long.ok) return { error: long.error };
  const userToken = String(long.data.access_token ?? "");
  const expiresIn = Number(long.data.expires_in ?? 0);

  // 3. The user's Pages (each entry carries a long-lived Page token).
  const pagesRes = await graph("me/accounts", { access_token: userToken, fields: "id,name,access_token,instagram_business_account{id,username}" });
  if (!pagesRes.ok) return { error: pagesRes.error };
  const pages = (pagesRes.data.data as { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[]) ?? [];
  if (pages.length === 0) return { error: "No Facebook Pages found on this account. Make sure you manage a Page." };
  // Prefer a Page that has an IG account linked; else the first Page.
  const page = pages.find((p) => p.instagram_business_account) ?? pages[0];

  const admin = createAdminClient();
  await admin
    .from("social_settings")
    .update({
      fb_page_id: page.id,
      fb_page_name: page.name,
      page_access_token: page.access_token,
      ig_user_id: page.instagram_business_account?.id ?? null,
      ig_username: page.instagram_business_account?.username ?? null,
      token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      connected_at: new Date().toISOString(),
      connected_by: connectedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return { error: null, pageName: page.name };
}

// --- Publishing --------------------------------------------------------------

export type PublishOutcome = { facebook?: string; instagram?: string; error?: string };

// Publish a post to the connected platforms it targets. Returns live URLs per
// platform, or an error. Best-effort per platform: a failure on one is reported
// but doesn't stop the other.
export async function publishPost(post: SocialPost, s: SocialSettings): Promise<PublishOutcome> {
  const out: PublishOutcome = {};
  const imageUrls = post.image_paths.map(publicImageUrl);
  const errors: string[] = [];

  if (post.platforms.includes("facebook") && s.fb_page_id && s.page_access_token) {
    const r = await publishFacebook(post, imageUrls, s.fb_page_id, s.page_access_token);
    if (r.error) errors.push(`Facebook: ${r.error}`);
    else out.facebook = r.url;
  }
  if (post.platforms.includes("instagram") && s.ig_user_id && s.page_access_token) {
    const r = await publishInstagram(post, imageUrls, s.ig_user_id, s.page_access_token);
    if (r.error) errors.push(`Instagram: ${r.error}`);
    else out.instagram = r.url;
  }
  if (errors.length) out.error = errors.join(" · ");
  return out;
}

async function publishFacebook(post: SocialPost, imageUrls: string[], pageId: string, token: string): Promise<{ url?: string; error?: string }> {
  const photos = imageUrls.filter((u) => !VIDEO_EXT.test(u));
  const caption = post.caption + (post.link ? `\n\n${post.link}` : "");

  // No image → plain feed post (optionally with a link preview).
  if (photos.length === 0) {
    const params: Record<string, string> = { message: post.caption, access_token: token };
    if (post.link) params.link = post.link;
    const r = await graph(`${pageId}/feed`, params, "POST");
    if (!r.ok) return { error: r.error };
    return { url: postUrl(String(r.data.id ?? "")) };
  }

  // Single photo.
  if (photos.length === 1) {
    const r = await graph(`${pageId}/photos`, { url: photos[0], caption, access_token: token }, "POST");
    if (!r.ok) return { error: r.error };
    const id = String(r.data.post_id ?? r.data.id ?? "");
    await maybeFirstComment(id, post.first_comment, token);
    return { url: postUrl(id) };
  }

  // Multi-photo → upload each unpublished, then a feed post attaching them.
  const mediaIds: string[] = [];
  for (const url of photos) {
    const up = await graph(`${pageId}/photos`, { url, published: "false", access_token: token }, "POST");
    if (!up.ok) return { error: up.error };
    mediaIds.push(String(up.data.id ?? ""));
  }
  const attached = mediaIds.map((id) => ({ media_fbid: id }));
  const r = await graph(`${pageId}/feed`, { message: caption, attached_media: JSON.stringify(attached), access_token: token }, "POST");
  if (!r.ok) return { error: r.error };
  const id = String(r.data.id ?? "");
  await maybeFirstComment(id, post.first_comment, token);
  return { url: postUrl(id) };
}

async function publishInstagram(post: SocialPost, imageUrls: string[], igUserId: string, token: string): Promise<{ url?: string; error?: string }> {
  const images = imageUrls.filter((u) => !VIDEO_EXT.test(u));
  if (images.length === 0) return { error: "Instagram needs an image (video auto-publish isn't supported yet)." };

  let creationId = "";
  if (images.length === 1) {
    const c = await graph(`${igUserId}/media`, { image_url: images[0], caption: post.caption, access_token: token }, "POST");
    if (!c.ok) return { error: c.error };
    creationId = String(c.data.id ?? "");
  } else {
    // Carousel: create each child, then the carousel container.
    const children: string[] = [];
    for (const url of images.slice(0, 10)) {
      const child = await graph(`${igUserId}/media`, { image_url: url, is_carousel_item: "true", access_token: token }, "POST");
      if (!child.ok) return { error: child.error };
      children.push(String(child.data.id ?? ""));
    }
    const container = await graph(`${igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: post.caption, access_token: token }, "POST");
    if (!container.ok) return { error: container.error };
    creationId = String(container.data.id ?? "");
  }

  const pub = await graph(`${igUserId}/media_publish`, { creation_id: creationId, access_token: token }, "POST");
  if (!pub.ok) return { error: pub.error };
  const mediaId = String(pub.data.id ?? "");
  await maybeFirstComment(mediaId, post.first_comment, token);

  // Fetch the permalink (best-effort).
  const perma = await graph(mediaId, { fields: "permalink", access_token: token });
  const url = perma.ok ? String(perma.data.permalink ?? "") : "";
  return { url: url || undefined };
}

async function maybeFirstComment(objectId: string, comment: string | null, token: string): Promise<void> {
  if (!comment || !objectId) return;
  await graph(`${objectId}/comments`, { message: comment, access_token: token }, "POST");
}

function postUrl(id: string): string | undefined {
  if (!id) return undefined;
  return `https://www.facebook.com/${id}`;
}
