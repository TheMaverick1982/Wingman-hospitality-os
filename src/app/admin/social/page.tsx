import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl, type SocialPost } from "@/lib/social";
import { getSocialSettings, isConnected, metaConfigured } from "@/lib/social-meta";
import { isLinkedInConnected, linkedinConfigured } from "@/lib/social-linkedin";
import { anyConnected as anyPlatformConnected } from "@/lib/social-publish";
import { SocialToolbar } from "./toolbar";
import { SocialBoard } from "./social-board";
import { Connections } from "./connections";

export const metadata: Metadata = { title: "Social · Admin" };

function withUrls(post: SocialPost) {
  return { ...post, imageUrls: post.image_paths.map((path) => ({ path, url: publicImageUrl(path) })) };
}

const META_FLASH: Record<string, { kind: "ok" | "error"; text: string }> = {
  connected: { kind: "ok", text: "✓ Connected to Meta." },
  denied: { kind: "error", text: "Connection cancelled." },
  badstate: { kind: "error", text: "Connection expired — please try again." },
  unconfigured: { kind: "error", text: "Meta app isn't configured (missing META_APP_ID / META_APP_SECRET)." },
};
const LI_FLASH: Record<string, { kind: "ok" | "error"; text: string }> = {
  connected: { kind: "ok", text: "✓ Connected to LinkedIn." },
  denied: { kind: "error", text: "LinkedIn connection cancelled." },
  badstate: { kind: "error", text: "LinkedIn connection expired — please try again." },
  unconfigured: { kind: "error", text: "LinkedIn app isn't configured (missing LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET)." },
};

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ meta?: string; li?: string; msg?: string }> }) {
  await requirePlatformSection("social");
  const admin = createAdminClient();

  const [{ data }, settings] = await Promise.all([
    admin
      .from("social_posts")
      .select("*")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getSocialSettings(),
  ]);
  const posts = ((data ?? []) as SocialPost[]).map(withUrls);
  const connected = anyPlatformConnected(settings);

  const { meta, li, msg } = await searchParams;
  const flash = meta
    ? META_FLASH[meta] ?? (meta === "error" ? { kind: "error" as const, text: msg ?? "Connection failed." } : null)
    : li
      ? LI_FLASH[li] ?? (li === "error" ? { kind: "error" as const, text: msg ?? "LinkedIn connection failed." } : null)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Social</h1>
        <p className="text-sm text-muted mt-1">
          Plan and schedule Wingman&rsquo;s posts. Connect Meta to publish automatically at each post&rsquo;s time — or leave it off
          and get a reminder to copy the caption, download the image, and post yourself.
        </p>
      </div>

      <Connections
        anyConnected={connected}
        autoPublish={settings?.auto_publish ?? false}
        meta={{
          configured: metaConfigured(),
          connected: isConnected(settings),
          pageName: settings?.fb_page_name ?? null,
          igUsername: settings?.ig_username ?? null,
        }}
        linkedin={{
          configured: linkedinConfigured(),
          connected: isLinkedInConnected(settings),
          name: settings?.li_member_name ?? null,
        }}
        flash={flash}
      />

      <SocialToolbar connected={connected} />

      {posts.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No posts yet. Add one, or import a plan from Claude Design.
        </div>
      ) : (
        <SocialBoard posts={posts} connected={connected} />
      )}
    </div>
  );
}
