import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { BroadcastForm } from "./broadcast-form";

export const metadata: Metadata = { title: "Broadcast · CRM" };

export default async function BroadcastPage() {
  await requirePlatformSection("crm");
  const admin = createAdminClient();

  // Aggregate the tags in use, with how many contacts carry each. Unsubscribed
  // contacts are excluded from the counts (they can't be emailed anyway).
  const { data: rows } = await admin
    .from("crm_contacts")
    .select("tags, unsubscribed")
    .limit(10000);
  const contacts = (rows ?? []) as { tags: string[] | null; unsubscribed: boolean | null }[];

  const counts = new Map<string, number>();
  for (const c of contacts) {
    if (c.unsubscribed) continue;
    for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const tags = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Broadcast</h1>
        <p className="text-sm text-muted mt-1">Send a one-off email to everyone carrying a tag — affiliates, a funnel, any segment.</p>
      </div>

      {tags.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No tags yet. Contacts get tagged automatically as leads and affiliates come in.
        </div>
      ) : (
        <BroadcastForm tags={tags} />
      )}
    </div>
  );
}
