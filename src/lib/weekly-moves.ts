// Weekly 3-moves commitment. Owners pick up to three concrete moves for the
// week; the system tracks them and shows progress. A commitment device — writing
// down three things you'll actually do beats an open-ended to-do list, and
// ticking them off is its own accountability.

export type Move = { text: string; done: boolean };
export const MAX_MOVES = 3;

// Starter ideas — habits that move the needle. The card offers these as one-tap
// fills; owners can also write their own.
export const MOVE_SUGGESTIONS: string[] = [
  "Run a floor spot-check on the busiest shift",
  "Personally text 5 first-timers who haven't come back",
  "Recognize one team member for a culture moment",
  "Complete the daily manager checklist every day",
  "Coach one server on a real moment this week",
  "Review last week's numbers with a manager",
  "Ask 3 regulars for a referral",
  "Log every first-time guest at the door",
];

// Monday (UTC) of the week containing nowMs, as YYYY-MM-DD. Pure/testable.
export function weekStartOf(nowMs: number): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
  return monday.toISOString().slice(0, 10);
}

// Clean raw text inputs into at most MAX_MOVES non-empty moves (all not-done).
export function normalizeMoves(texts: string[]): Move[] {
  return texts
    .map((t) => (t ?? "").trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_MOVES)
    .map((text) => ({ text, done: false }));
}

// When re-saving mid-week, keep a move's done state if its text is unchanged.
export function mergeDone(next: Move[], prev: Move[]): Move[] {
  const doneByText = new Map(prev.filter((m) => m.done).map((m) => [m.text, true]));
  return next.map((m) => ({ ...m, done: doneByText.get(m.text) ?? false }));
}

export function parseMoves(raw: unknown): Move[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { text?: unknown; done?: unknown } => !!m && typeof m === "object")
    .map((m) => ({ text: String((m as { text?: unknown }).text ?? "").trim(), done: !!(m as { done?: unknown }).done }))
    .filter((m) => m.text.length > 0)
    .slice(0, MAX_MOVES);
}

export type WeeklyMoves = { weekStart: string; moves: Move[] };
