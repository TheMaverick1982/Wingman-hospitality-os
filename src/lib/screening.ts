// Pre-interview screening: per-role questions asked on the public application
// form, and the AI grade computed from the answers. Pure/client-safe types and
// small helpers (no server imports), shared by the public form, the grader, and
// the manager review UI.

export type ScreeningAxis = "hospitality" | "follows_instructions";

export type ScreeningQuestion = {
  id: string;
  department: string;
  prompt: string;
  axis: ScreeningAxis;
  sort_order: number;
  source: "wingman" | "custom";
};

// A stored answer keeps the prompt at submit time, so the manager's view is
// stable even if the owner later edits or removes the question.
export type ScreeningAnswer = { id: string; prompt: string; axis: ScreeningAxis; value: string };

export type ScreeningAxisGrade = { score: number; rationale: string }; // score 1–5

export type ScreeningTier = "strong" | "worth_a_look" | "pass";

export type ScreeningGrade = {
  hospitality: ScreeningAxisGrade;
  followsInstructions: ScreeningAxisGrade;
  overall: number; // 1–5, average of the two axes
  tier: ScreeningTier;
  summary: string;
};

export const AXIS_LABEL: Record<ScreeningAxis, string> = {
  hospitality: "Guest experience",
  follows_instructions: "Follows instructions",
};

export function isScreeningAxis(v: unknown): v is ScreeningAxis {
  return v === "hospitality" || v === "follows_instructions";
}

// Tier presentation for the manager card.
export const TIER_META: Record<ScreeningTier, { label: string; fg: string; bg: string }> = {
  strong: { label: "Strong fit", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]" },
  worth_a_look: { label: "Worth a look", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]" },
  pass: { label: "Probably pass", fg: "text-charcoal-2", bg: "bg-[#F1F1F1]" },
};

// Derive a tier from the overall 1–5 score, if the model didn't give a clean one.
export function tierFromScore(overall: number): ScreeningTier {
  if (overall >= 4) return "strong";
  if (overall >= 2.75) return "worth_a_look";
  return "pass";
}
