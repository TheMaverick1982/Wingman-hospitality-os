// Guest Survey question set + helpers. Pure data (no server imports) so the
// public form and the manager archive can both use it. Phase 1 uses a fixed set;
// per-org editable questions can come later.
export type SurveyQuestion = { id: string; label: string; kind: "rating" | "text" };

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: "food", label: "How was the food?", kind: "rating" },
  { id: "service", label: "How was the service?", kind: "rating" },
  { id: "return", label: "How likely are you to come back?", kind: "rating" },
  { id: "comment", label: "Anything you'd like to share?", kind: "text" },
];

export const RATING_QUESTIONS = SURVEY_QUESTIONS.filter((q) => q.kind === "rating");
export const RATING_IDS = RATING_QUESTIONS.map((q) => q.id);
export const RATING_LABEL: Record<string, string> = Object.fromEntries(RATING_QUESTIONS.map((q) => [q.id, q.label]));

// Average across the rating questions present in a response (1–5). 0 if none.
export function avgRating(ratings: Record<string, unknown>): number {
  const vals = RATING_IDS.map((id) => Number(ratings?.[id])).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// A response counts as a "positive" (a shout-out worth surfacing) when it's
// strongly rated — used to pull the good ones for recognition.
export function isPositive(ratings: Record<string, unknown>): boolean {
  return avgRating(ratings) >= 4.5;
}
