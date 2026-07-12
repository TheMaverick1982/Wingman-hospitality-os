import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl, type SocialPost } from "@/lib/social";
import type { SocialSettings } from "@/lib/social-meta";

// LinkedIn (personal profile) publishing via the member's w_member_social
// permission. Token + member URN live in social_settings (deny-all RLS).

const REST = "https://api.linkedin.com/rest";
// LinkedIn versions its API monthly (YYYYMM) and deprecates old ones; override
// via env if LinkedIn bumps the required version.
const LI_VERSION = process.env.LINKEDIN_API_VERSION ?? "202501";
const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;
export const LI_SCOPES = "openid profile w_member_social";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
}
export function linkedinRedirectUri(): string {
  return `${siteUrl()}/api/social/linkedin/callback`;
}
export function linkedinConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}
export function isLinkedInConnected(s: SocialSettings | null): boolean {
  if (!s?.li_access_token || !s?.li_member_id) return false;
  if (s.li_token_expires_at && new Date(s.li_token_expires_at).getTime() <= Date.now()) return false; // expired → reconnect
  return true;
}

export function linkedinAuthUrl(state: string): string {
  // Build manually with encodeURIComponent so spaces in `scope` become %20, not
  // "+". LinkedIn rejects "+"-joined scopes ("Bummer, something went wrong").
  const params = [
    "response_type=code",
    `client_id=${encodeURIComponent(process.env.LINKEDIN_CLIENT_ID ?? "")}`,
    `redirect_uri=${encodeURIComponent(linkedinRedirectUri())}`,
    `state=${encodeURIComponent(state)}`,
    `scope=${encodeURIComponent(LI_SCOPES)}`,
  ];
  return `https://www.linkedin.com/oauth/v2/authorization?${params.join("&")}`;
}

// Exchange the OAuth code for a token + the member's identity, then persist.
export async function completeLinkedInOAuth(code: string, connectedBy: string): Promise<{ error: string | null; name?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: linkedinRedirectUri(),
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  let accessToken = "";
  let expiresIn = 0;
  try {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !json.access_token) return { error: json.error_description ?? "LinkedIn token exchange failed." };
    accessToken = json.access_token;
    expiresIn = Number(json.expires_in ?? 0);
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Identity via OpenID Connect userinfo (sub = member id).
  let sub = "";
  let name = "";
  try {
    const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
    const meJson = (await me.json()) as { sub?: string; name?: string };
    if (!me.ok || !meJson.sub) return { error: "Couldn't read your LinkedIn profile." };
    sub = meJson.sub;
    name = meJson.name ?? "";
  } catch (e) {
    return { error: (e as Error).message };
  }

  const admin = createAdminClient();
  await admin
    .from("social_settings")
    .update({
      li_member_id: sub,
      li_member_name: name,
      li_access_token: accessToken,
      li_token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      li_connected_at: new Date().toISOString(),
      li_connected_by: connectedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  return { error: null, name };
}

// LinkedIn's Posts API "commentary" uses a little-text format where these
// characters must be backslash-escaped, or the post is rejected.
function escapeCommentary(text: string): string {
  return text.replace(/[\\<>|{}()\[\]@~_*#]/g, (c) => `\\${c}`);
}

// Publish a post to the member's LinkedIn feed. Returns the live URL or an error.
export async function publishLinkedIn(post: SocialPost, s: SocialSettings): Promise<{ url?: string; error?: string }> {
  const token = s.li_access_token;
  const author = `urn:li:person:${s.li_member_id}`;
  if (!token || !s.li_member_id) return { error: "Not connected." };
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "LinkedIn-Version": LI_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  // Upload images (LinkedIn hosts them; we register → PUT bytes → get a URN).
  const imageUrls = post.image_paths.map(publicImageUrl).filter((u) => !VIDEO_EXT.test(u));
  const imageUrns: string[] = [];
  for (const url of imageUrls.slice(0, 9)) {
    const r = await uploadLinkedInImage(url, author, token, headers);
    if (r.error) return { error: `image upload failed — ${r.error}` };
    if (r.urn) imageUrns.push(r.urn);
  }

  const commentary = escapeCommentary(post.caption + (post.link ? `\n\n${post.link}` : ""));
  const body: Record<string, unknown> = {
    author,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (imageUrns.length === 1) {
    body.content = { media: { id: imageUrns[0] } };
  } else if (imageUrns.length > 1) {
    body.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } };
  }

  try {
    const res = await fetch(`${REST}/posts`, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status !== 201 && !res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return { error: err.message ?? `LinkedIn error (${res.status})` };
    }
    const postUrn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
    return { url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : "https://www.linkedin.com/feed/" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function uploadLinkedInImage(publicUrl: string, author: string, token: string, headers: Record<string, string>): Promise<{ urn?: string; error?: string }> {
  try {
    // 1. Register the upload.
    const init = await fetch(`${REST}/images?action=initializeUpload`, {
      method: "POST",
      headers,
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    if (!init.ok) {
      const body = await init.text();
      return { error: `initialize ${init.status}: ${body.slice(0, 220)}` };
    }
    const initJson = (await init.json()) as { value?: { uploadUrl?: string; image?: string } };
    const uploadUrl = initJson.value?.uploadUrl;
    const imageUrn = initJson.value?.image;
    if (!uploadUrl || !imageUrn) return { error: "no upload URL returned by LinkedIn" };

    // 2. Fetch our stored image, then PUT the bytes to LinkedIn.
    const src = await fetch(publicUrl);
    if (!src.ok) return { error: `couldn't read the stored image (${src.status})` };
    const contentType = src.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await src.arrayBuffer());
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      body: buf,
    });
    if (!put.ok) {
      const body = await put.text();
      return { error: `upload ${put.status}: ${body.slice(0, 220)}` };
    }
    return { urn: imageUrn };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
