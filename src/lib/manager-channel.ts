import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ManagerMessage = {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export type ManagerThread = { root: ManagerMessage; replies: ManagerMessage[] };

// The org's manager channel as threads (top-level post + its replies, oldest
// first). Read via the admin client scoped to the org — the page is already
// manager-gated. Guarded so a not-yet-applied migration can't break the page.
export async function getManagerThreads(orgId: string, currentUserId: string, limit = 60): Promise<ManagerThread[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("manager_channel_messages")
      .select("id, parent_id, author_id, author_name, body, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as {
      id: string; parent_id: string | null; author_id: string | null; author_name: string; body: string; created_at: string;
    }[];

    const toMsg = (r: (typeof rows)[number]): ManagerMessage => ({
      id: r.id,
      authorId: r.author_id,
      authorName: r.author_name,
      body: r.body,
      createdAt: r.created_at,
      isMine: r.author_id === currentUserId,
    });

    const threads = new Map<string, ManagerThread>();
    for (const r of rows) if (!r.parent_id) threads.set(r.id, { root: toMsg(r), replies: [] });
    for (const r of rows) if (r.parent_id && threads.has(r.parent_id)) threads.get(r.parent_id)!.replies.push(toMsg(r));

    // Newest thread first (by the last activity — reply or the root itself).
    return Array.from(threads.values())
      .sort((a, b) => {
        const aLast = a.replies.length ? a.replies[a.replies.length - 1].createdAt : a.root.createdAt;
        const bLast = b.replies.length ? b.replies[b.replies.length - 1].createdAt : b.root.createdAt;
        return bLast.localeCompare(aLast);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}
