// The Standout Audit + 5-Gap Diagnosis -- the front-door scorecard of the
// Regulars Operating System. Two scores come out of one walkthrough:
//   - Health Score (0-100): the 5-Gap Diagnosis, which locates the single
//     most-open "constraint gap" to fix first.
//   - Audit Score (0-100): a weighted 7-domain read of the live guest
//     experience.
// Both are entered as simple 0-5 ratings per line; the weights live here so
// the entry stays fast and the math stays consistent.

export type FiveGap = {
  key: string;
  label: string;
  question: string;
  symptom: string;
};

// Ordering here is the stored order of gap_scores[].
export const FIVE_GAPS: FiveGap[] = [
  {
    key: "leadership",
    label: "Leadership",
    question: "Do managers set and hold the standard, or firefight?",
    symptom: "Owner-dependence, blame culture, quality dips when you're off.",
  },
  {
    key: "standards",
    label: "Standards",
    question: "Is “good” defined so specifically anyone can verify it?",
    symptom: "Vague expectations, argued judgment calls, slow drift.",
  },
  {
    key: "training",
    label: "Training",
    question: "Is skill built by daily reps, or one-time onboarding?",
    symptom: "New hires thrown to the floor, uneven service, no upselling.",
  },
  {
    key: "experience",
    label: "Experience",
    question: "Is the guest journey designed to create reactions?",
    symptom: "Forgettable visits, low repeat rate, no emotional memory.",
  },
  {
    key: "growth",
    label: "Growth",
    question: "Are the profit levers measured and worked deliberately?",
    symptom: "Flat check average, no win-back, one marketing channel.",
  },
];

export type AuditDomain = {
  key: string;
  label: string;
  weight: number;
  hint: string;
};

// Weights sum to 100. Stored order is the order of domain_scores[].
export const AUDIT_DOMAINS: AuditDomain[] = [
  { key: "food", label: "Food Quality", weight: 20, hint: "Temp on target, plating spec met, same dish consistent twice." },
  { key: "service", label: "Service", weight: 18, hint: "Greeting < 30s, a named recommendation per course, warm close." },
  { key: "timing", label: "Timing", weight: 14, hint: "Fast first drink, course pacing, ticket times in target." },
  { key: "ambiance", label: "Ambiance", weight: 16, hint: "Sight lines & flow, lighting, music set to the shift's goal, comfort." },
  { key: "personalization", label: "Personalization", weight: 12, hint: "Returning guests recognized, first-timers flagged and converted." },
  { key: "cleanliness", label: "Cleanliness", weight: 12, hint: "Glassware spotless, restrooms, entry, back-bar." },
  { key: "memory", label: "Emotional Memory", weight: 8, hint: "One “stop-what-you're-doing” moment worth telling a story about." },
];

const MAX_RATING = 5;

/** 5-Gap Diagnosis: each gap rated 0-5 -> 0-20 points -> Health Score /100. */
export function healthScore(gapStars: number[]): number {
  const total = FIVE_GAPS.reduce((sum, _g, i) => sum + clampStar(gapStars[i]) * (20 / MAX_RATING), 0);
  return Math.round(total);
}

/** Standout Audit: each domain rated 0-5, contributing its weight. */
export function auditScore(domainStars: number[]): number {
  const total = AUDIT_DOMAINS.reduce((sum, d, i) => sum + d.weight * (clampStar(domainStars[i]) / MAX_RATING), 0);
  return Math.round(total);
}

/** Index of the most-open (lowest-rated) gap -- the constraint to fix first. */
export function constraintGapIndex(gapStars: number[]): number {
  let worst = 0;
  for (let i = 1; i < FIVE_GAPS.length; i++) {
    if (clampStar(gapStars[i]) < clampStar(gapStars[worst])) worst = i;
  }
  return worst;
}

export type ScoreTone = { label: string; fg: string; bg: string; dot: string };

export function scoreTone(pct: number): ScoreTone {
  if (pct >= 80) return { label: "Strong", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]", dot: "bg-[#16A34A]" };
  if (pct >= 55) return { label: "Solid, with gaps", fg: "text-brick-dark", bg: "bg-brick-tint", dot: "bg-brick" };
  return { label: "At risk", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]", dot: "bg-[#D97706]" };
}

function clampStar(v: number | undefined): number {
  if (!Number.isFinite(v as number)) return 0;
  return Math.max(0, Math.min(MAX_RATING, Math.round(v as number)));
}

export type AuditRecord = {
  id: string;
  occurred_on: string;
  location_id: string | null;
  health_score: number;
  audit_score: number;
  gap_scores: number[];
  domain_scores: number[];
  action_plan: string;
};

/**
 * A deterministic action plan used when the AI generator is unavailable (no
 * API key or a failed call), so the scorecard is always useful on its own.
 */
export function fallbackActionPlan(gapStars: number[]): string {
  const idx = constraintGapIndex(gapStars);
  const gap = FIVE_GAPS[idx];
  const moves: Record<string, string[]> = {
    leadership: [
      "Put a manager on the floor front-to-back during every peak period and hold a daily 5-minute pre-shift.",
      "Define what a manager must inspect each shift, and log it.",
      "Coach one real moment per shift: praise in public, correct in private.",
    ],
    standards: [
      "Rewrite your top 5 vague standards into specific, observable, checkable behaviors.",
      "Attach a spot-check to each so someone can verify it in seconds.",
      "Pick one standard as this week's focus and drill it every pre-shift.",
    ],
    training: [
      "Replace one-time onboarding with a 5-10 minute daily rep per role.",
      "Certify each role live (a manager watches the behavior and signs off).",
      "Teach the guided-selling structure: identify → reason → pre-empt the objection → contrast → ask.",
    ],
    experience: [
      "Map your guest journey touchpoint by touchpoint and assign each an intended reaction.",
      "Flag first-time guests in real time so the whole team converts them.",
      "Add one surprise-and-delight gesture per shift to manufacture a story.",
    ],
    growth: [
      "Pick one profit lever (average check, frequency, or reactivation) and set a believable small target.",
      "Turn on lapsed-guest win-back for regulars who have gone quiet.",
      "Ask your best guests for a referral only after a clearly great visit.",
    ],
  };
  const list = (moves[gap.key] ?? []).map((m, i) => `${i + 1}. ${m}`).join("\n");
  return `Your most-open gap is **${gap.label}**. Close it first — effort spent elsewhere leaks out through it.\n\n${list}`;
}
