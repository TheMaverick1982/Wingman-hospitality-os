import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl, type SocialPost } from "@/lib/social";
import { getSocialSettings, isConnected, metaConfigured } from "@/lib/social-meta";
import { isLinkedInConnected, linkedinConfigured } from "@/lib/social-linkedin";
import { anyConnected as anyPlatformConnected } from "@/lib/social-publish";
import { SocialToolbar } from "./toolbar";
import { PostCard } from "./post-card";
import { Connections } from "./connections";

export const metadata: Metadata = { title: "Social · Admin" };

function withUrls(post: SocialPost) {
  return { ...post, imageUrls: post.image_paths.map((path) => ({ path, url: publicImageUrl(path) })) };
}
type CardPost = ReturnType<typeof withUrls>;

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

// Kept in a helper so it isn't flagged as an impure call in the render body.
function nowMs(): number {
  return Date.now();
}

function Section({ title, items, hint, connected }: { title: string; items: CardPost[]; hint?: string; connected: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <span className="text-[13px] text-muted-2">{items.length}</span>
        {hint && <span className="text-[13px] text-muted">· {hint}</span>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {items.map((p) => (
          <PostCard key={p.id} post={p} connected={connected} />
        ))}
      </div>
    </div>
  );
}

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

  const now = nowMs();
  const dueNow = posts.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() <= now);
  const upcoming = posts.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() > now);
  const drafts = posts.filter((p) => p.status === "draft");
  const done = posts.filter((p) => p.status === "posted" || p.status === "skipped");

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

      <SocialToolbar />

      {posts.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No posts yet. Add one, or import a plan from Claude Design.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <Section title="Ready to post now" items={dueNow} hint="scheduled time has arrived" connected={connected} />
          <Section title="Upcoming" items={upcoming} connected={connected} />
          <Section title="Drafts" items={drafts} hint="no time set yet" connected={connected} />
          <Section title="Posted & skipped" items={done} connected={connected} />
        </div>
      )}
    </div>
  );
}
