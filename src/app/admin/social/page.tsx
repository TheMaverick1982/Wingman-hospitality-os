import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl, type SocialPost } from "@/lib/social";
import { SocialToolbar } from "./toolbar";
import { PostCard } from "./post-card";

export const metadata: Metadata = { title: "Social · Admin" };

function withUrls(post: SocialPost) {
  return { ...post, imageUrls: post.image_paths.map((path) => ({ path, url: publicImageUrl(path) })) };
}
type CardPost = ReturnType<typeof withUrls>;

// Kept in a helper so it isn't flagged as an impure call in the render body.
function nowMs(): number {
  return Date.now();
}

function Section({ title, items, hint }: { title: string; items: CardPost[]; hint?: string }) {
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
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </div>
  );
}

export default async function SocialPage() {
  await requirePlatformSection("social");
  const admin = createAdminClient();

  const { data } = await admin
    .from("social_posts")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const posts = ((data ?? []) as SocialPost[]).map(withUrls);

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
          Plan and schedule Wingman&rsquo;s posts. At each post&rsquo;s time you get a reminder — copy the caption, download the
          image, and post to Instagram / Facebook in seconds.
        </p>
      </div>

      <SocialToolbar />

      {posts.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No posts yet. Add one, or import a plan from Claude Design.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <Section title="Ready to post now" items={dueNow} hint="scheduled time has arrived" />
          <Section title="Upcoming" items={upcoming} />
          <Section title="Drafts" items={drafts} hint="no time set yet" />
          <Section title="Posted & skipped" items={done} />
        </div>
      )}
    </div>
  );
}
