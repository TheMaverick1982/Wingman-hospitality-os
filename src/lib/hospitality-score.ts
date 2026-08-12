// The Hospitality Score: a 10-statement owner self-assessment (each scored 1-10,
// for a 0-100 total) that diagnoses how intentional a restaurant's hospitality
// culture is, then points the owner at the Wingman tools that move their weakest
// areas. Pure/client-safe — shared by the page, the form, and the server action.
// The statements are distilled from guest-experience training doctrine (service
// vs. hospitality, the 10/10 standard, unconditional hospitality, the why).

export const SCORE_COUNT = 10;
export const MAX_SCORE = 100;

export type FixLink = { label: string; href: string; why: string };

export type ScoreStatement = {
  id: string;
  // Shown as the thing the owner rates 1 (strongly disagree) to 10 (completely agree).
  text: string;
  // Short label for the result breakdown.
  area: string;
  // Where to go in Wingman to raise this score, shown when the statement scores low.
  fixes: FixLink[];
};

// Order is stable — `scores[i]` corresponds to STATEMENTS[i]. Never reorder
// without a data migration, since stored assessments are positional arrays.
export const SCORE_STATEMENTS: ScoreStatement[] = [
  {
    id: "culture_sentence",
    text: "I can describe my hospitality culture in one sentence.",
    area: "A clear culture",
    fixes: [
      { label: "Owner's Mindset", href: "/settings", why: "Put your hospitality philosophy into words — it grounds every AI-built standard and the whole team." },
      { label: "Guest Journey", href: "/journey", why: "Turn that philosophy into a named, ordered experience the team trains on." },
    ],
  },
  {
    id: "return_experience",
    text: "Guests come back because of the experience, not just the food.",
    area: "Experience-driven return",
    fixes: [
      { label: "Guest Bounce Back", href: "/bounceback", why: "See who's actually returning and win back the regulars who are slipping." },
      { label: "Guest Reviews", href: "/reviews", why: "Hear, in guests' own words, whether the experience is what brings them back." },
    ],
  },
  {
    id: "model_every_shift",
    text: "I personally model hospitality every single shift. No exceptions.",
    area: "Leading by example",
    fixes: [
      { label: "Shift Hub", href: "/shift", why: "Set the tone before the shift — the team mirrors the standard they see from you." },
      { label: "Accountability", href: "/accountability", why: "Hold the daily behaviors you expect, starting with your own." },
    ],
  },
  {
    id: "obsessed_experience",
    text: "I am obsessed with the guest experience, not just the bottom line.",
    area: "Experience focus",
    fixes: [
      { label: "Guest Journey", href: "/journey", why: "Design every touchpoint on purpose instead of leaving it to chance." },
      { label: "Standout Audit", href: "/audit", why: "Pressure-test your experience against what a standout restaurant does." },
    ],
  },
  {
    id: "feel_something",
    text: "My guests feel something when they leave. Not just full — something.",
    area: "Emotional impact",
    fixes: [
      { label: "Guest Journey", href: "/journey", why: "Nail the farewell — the last moment is what a guest remembers and repeats." },
      { label: "Guest Reviews", href: "/reviews", why: "Watch for the reviews that mention how the visit felt, not just the food." },
    ],
  },
  {
    id: "service_vs_hospitality",
    text: "My team knows the difference between service and hospitality.",
    area: "Team understanding",
    fixes: [
      { label: "Training & Standards", href: "/training", why: "Build a program that teaches hospitality, not just the steps of service." },
    ],
  },
  {
    id: "understands_why",
    text: "My team understands WHY hospitality matters — not just what to do.",
    area: "The why",
    fixes: [
      { label: "Training & Standards", href: "/training", why: "Wingman grounds every standard in its reason, so belief sticks where compliance fades." },
    ],
  },
  {
    id: "defined_ten",
    text: "I have a clearly defined standard for what a 10-out-of-10 experience looks like.",
    area: "A defined 10/10",
    fixes: [
      { label: "Guest Journey", href: "/journey", why: "Describe the perfect experience moment-by-moment — you can't hold a team to a standard you never defined." },
    ],
  },
  {
    id: "unconditional",
    text: "Hospitality is unconditional on my team — same experience, every guest, every time.",
    area: "Consistency",
    fixes: [
      { label: "Training & Standards", href: "/training", why: "Train the belief that every guest gets your best, regardless of who they are." },
      { label: "Accountability", href: "/accountability", why: "Make the standard a daily, checkable habit so it holds on every shift." },
    ],
  },
  {
    id: "team_prioritizes",
    text: "My team makes hospitality the priority — I've seen it, not just hoped for it.",
    area: "Lived priority",
    fixes: [
      { label: "Culture", href: "/culture", why: "Recognize the moments the team gets it right so the behavior spreads." },
      { label: "Shift Hub", href: "/shift", why: "Capture wins and post-shift feedback so hospitality stays front-of-mind daily." },
    ],
  },
];

export type ScoreBand = { key: string; label: string; blurb: string; fg: string; bg: string };

// Four bands across 0-100. Colors are token classes used by the result card.
export function bandFor(total: number): ScoreBand {
  if (total >= 81) return { key: "elite", label: "Elite", blurb: "Hospitality is your identity. Protect it — consistency is the whole game now.", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]" };
  if (total >= 61) return { key: "strong", label: "Strong", blurb: "A real hospitality culture is in place. Tighten the weak spots below to reach elite.", fg: "text-[#0F766E]", bg: "bg-[#E6F4F1]" };
  if (total >= 41) return { key: "developing", label: "Developing", blurb: "The pieces are there but inconsistent. The focus areas below are your fastest wins.", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]" };
  return { key: "foundational", label: "Foundational", blurb: "This is the starting line — and a great place to build from. Start with one focus area below.", fg: "text-brick-dark", bg: "bg-brick-tint" };
}

// Validate + total a submitted set of scores (10 integers, each 1-10).
export function totalScore(scores: number[]): number {
  return scores.reduce((sum, n) => sum + (Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 0), 0);
}
export function isValidScores(scores: unknown): scores is number[] {
  return Array.isArray(scores) && scores.length === SCORE_COUNT && scores.every((n) => typeof n === "number" && n >= 1 && n <= 10);
}
