import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { listAllPosts, PLAYBOOK_CATEGORIES } from "@/lib/playbook";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "The Playbook · Admin" };
export const maxDuration = 60;

export default async function AdminPlaybookPage() {
  await requirePlatformSection("social");
  const posts = await listAllPosts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">The Playbook</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">Draft actionable, SEO-focused posts (with AI or by hand), review them, and publish to the public site at /playbook. Nothing goes live until you publish.</p>
      </div>
      <Composer categories={[...PLAYBOOK_CATEGORIES]} posts={posts} />
    </div>
  );
}
