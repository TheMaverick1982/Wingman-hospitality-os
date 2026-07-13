"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { weekStartOf, normalizeMoves, mergeDone, parseMoves, MAX_MOVES } from "@/lib/weekly-moves";

type Result = { ok: boolean; error?: string };

// Owner sets (or edits) this week's up-to-three moves. Ticks are preserved for
// any move whose text is unchanged.
export async function saveWeeklyMoves(texts: string[]): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { ok: false, error: "Only the owner can set the week's moves." };

  const next = normalizeMoves(Array.isArray(texts) ? texts.slice(0, MAX_MOVES) : []);
  if (next.length === 0) return { ok: false, error: "Add at least one move." };

  const weekStart = weekStartOf(Date.now());
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("weekly_commitments")
    .select("moves")
    .eq("org_id", profile.orgId)
    .eq("week_start", weekStart)
    .maybeSingle();
  const merged = mergeDone(next, parseMoves((existing as { moves?: unknown } | null)?.moves));

  const { error } = await supabase.from("weekly_commitments").upsert(
    {
      org_id: profile.orgId,
      week_start: weekStart,
      moves: merged,
      created_by: profile.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,week_start" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// Owner ticks / unticks one move by index for this week.
export async function toggleWeeklyMove(index: number): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { ok: false, error: "Not allowed." };

  const weekStart = weekStartOf(Date.now());
  const supabase = await createClient();

  const { data } = await supabase
    .from("weekly_commitments")
    .select("moves")
    .eq("org_id", profile.orgId)
    .eq("week_start", weekStart)
    .maybeSingle();
  const moves = parseMoves((data as { moves?: unknown } | null)?.moves);
  if (index < 0 || index >= moves.length) return { ok: false, error: "No such move." };

  moves[index] = { ...moves[index], done: !moves[index].done };
  const { error } = await supabase
    .from("weekly_commitments")
    .update({ moves, updated_at: new Date().toISOString() })
    .eq("org_id", profile.orgId)
    .eq("week_start", weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
