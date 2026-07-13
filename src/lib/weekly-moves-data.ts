import "server-only";
import { createClient } from "@/lib/supabase/server";
import { weekStartOf, parseMoves, type WeeklyMoves } from "@/lib/weekly-moves";

// This week's committed moves for the current org (SSR, RLS-scoped). Returns an
// empty list (not null) when nothing is set yet — the card shows the setup state.
// Kept out of weekly-moves.ts so that module stays pure and safe to import from
// the client card.
export async function getWeeklyMoves(): Promise<WeeklyMoves> {
  const weekStart = weekStartOf(Date.now());
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { weekStart, moves: [] };

  const { data } = await supabase
    .from("weekly_commitments")
    .select("moves")
    .eq("org_id", org.id as string)
    .eq("week_start", weekStart)
    .maybeSingle();

  return { weekStart, moves: parseMoves((data as { moves?: unknown } | null)?.moves) };
}
