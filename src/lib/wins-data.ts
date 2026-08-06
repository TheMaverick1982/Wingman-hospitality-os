import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type WinRow = {
  id: string;
  kind: string; // 'win' | 'shoutout'
  author: string;
  about: string;
  tag: string;
  message: string;
  occurredOn: string;
  reactions: number;
  reactedByMe: boolean;
};

// Recent wins + shout-outs for the feed, with celebrate counts and whether the
// current user has celebrated each. Read via the admin client scoped to the org;
// guarded so a not-yet-applied migration (kind column / reactions table) can't
// break the dashboard or culture page.
export async function getRecentWins(orgId: string, userId: string, limit = 6): Promise<WinRow[]> {
  try {
    const admin = createAdminClient();
    const { data: moments } = await admin
      .from("culture_moments")
      .select("id, kind, author, about, tag, message, occurred_on")
      .eq("org_id", orgId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    const rows = (moments ?? []) as {
      id: string; kind: string | null; author: string; about: string; tag: string; message: string; occurred_on: string;
    }[];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const { data: reactions } = await admin
      .from("culture_moment_reactions")
      .select("moment_id, user_id")
      .in("moment_id", ids);

    const counts = new Map<string, number>();
    const mine = new Set<string>();
    for (const r of (reactions ?? []) as { moment_id: string; user_id: string }[]) {
      counts.set(r.moment_id, (counts.get(r.moment_id) ?? 0) + 1);
      if (r.user_id === userId) mine.add(r.moment_id);
    }

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind ?? "shoutout",
      author: r.author,
      about: r.about ?? "",
      tag: r.tag,
      message: r.message,
      occurredOn: r.occurred_on,
      reactions: counts.get(r.id) ?? 0,
      reactedByMe: mine.has(r.id),
    }));
  } catch {
    return [];
  }
}
