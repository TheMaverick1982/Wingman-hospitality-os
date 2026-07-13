import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Idea, IdeaSort, IdeaStatus } from "@/lib/feature-ideas";

// The board is cross-org (every signed-in user sees every idea), so this reads
// with the RLS-scoped client whose select policy allows any authenticated user.
export async function getIdeas(sort: IdeaSort): Promise<Idea[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: ideaRows }, { data: voteRows }] = await Promise.all([
    supabase.from("feature_ideas").select("id, title, details, status, created_at").limit(500),
    supabase.from("feature_idea_votes").select("idea_id, profile_id").limit(5000),
  ]);

  const votes = (voteRows ?? []) as { idea_id: string; profile_id: string }[];
  const countByIdea = new Map<string, number>();
  const votedByMe = new Set<string>();
  for (const v of votes) {
    countByIdea.set(v.idea_id, (countByIdea.get(v.idea_id) ?? 0) + 1);
    if (user && v.profile_id === user.id) votedByMe.add(v.idea_id);
  }

  const ideas: Idea[] = ((ideaRows ?? []) as { id: string; title: string; details: string; status: IdeaStatus; created_at: string }[]).map((r) => ({
    id: r.id,
    title: r.title,
    details: r.details,
    status: r.status,
    created_at: r.created_at,
    votes: countByIdea.get(r.id) ?? 0,
    voted: votedByMe.has(r.id),
  }));

  ideas.sort((a, b) => {
    if (sort === "most") return b.votes - a.votes || b.created_at.localeCompare(a.created_at);
    if (sort === "least") return a.votes - b.votes || b.created_at.localeCompare(a.created_at);
    return b.created_at.localeCompare(a.created_at); // newest
  });
  return ideas;
}
