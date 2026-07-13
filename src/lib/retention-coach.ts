// Retention drop-off analysis for Guest Bounce Back. Pure + client-safe (no
// server imports) so both the page and the coach UI can use it. Turns the visit
// funnel into "where are we losing the most people, and is it worth coaching?"

import { stageOf, type GuestWithVisits } from "./hospitality";

export type DropStage = {
  fromVisit: number; // e.g. 2  => the visit they stop after
  toVisit: number; // e.g. 3
  reached: number; // guests who reached fromVisit
  advanced: number; // ...who went on to toVisit
  retentionPct: number; // advanced / reached * 100
  lostPct: number; // 100 - retentionPct
};

export type RetentionAnalysis = {
  totalTracked: number; // guests who logged at least visit 1
  stages: DropStage[]; // the three transitions (1→2, 2→3, 3→4) with enough base
  worst: DropStage | null; // the eligible transition with the lowest retention
  hasSignal: boolean; // enough data + a meaningful drop to coach on
};

// Need a real sample before we start diagnosing, and a base at each transition
// so a single guest doesn't swing the rate. Below ~65% kept is where a nudge is
// worth surfacing; above that, retention is healthy enough to leave alone.
const MIN_TRACKED = 8;
const MIN_STAGE_BASE = 5;
const COACH_BELOW_PCT = 65;

export function analyzeRetention(counts: number[]): RetentionAnalysis {
  const [c1 = 0, c2 = 0, c3 = 0, c4 = 0] = counts;
  const totalTracked = c1;

  const raw: DropStage[] = [
    { fromVisit: 1, toVisit: 2, reached: c1, advanced: c2 },
    { fromVisit: 2, toVisit: 3, reached: c2, advanced: c3 },
    { fromVisit: 3, toVisit: 4, reached: c3, advanced: c4 },
  ].map((s) => ({
    ...s,
    retentionPct: s.reached > 0 ? Math.round((s.advanced / s.reached) * 100) : 0,
    lostPct: s.reached > 0 ? 100 - Math.round((s.advanced / s.reached) * 100) : 0,
  }));

  // Only transitions with a big enough base are eligible to be "the worst".
  const eligible = raw.filter((s) => s.reached >= MIN_STAGE_BASE);
  const worst = eligible.length
    ? eligible.reduce((lo, s) => (s.retentionPct < lo.retentionPct ? s : lo))
    : null;

  const hasSignal = totalTracked >= MIN_TRACKED && worst !== null && worst.retentionPct < COACH_BELOW_PCT;

  return { totalTracked, stages: raw, worst, hasSignal };
}

// Human phrase for the drop point, e.g. "after their 2nd visit".
export function dropLabel(stage: DropStage): string {
  const ord = ["", "1st", "2nd", "3rd", "4th"][stage.fromVisit] ?? `${stage.fromVisit}th`;
  return `after their ${ord} visit`;
}

export type LocationRetention = {
  locationId: string;
  name: string;
  tracked: number; // guests whose first visit was here
  reached: number; // ...who reached the transition's "from" visit
  advanced: number; // ...who continued to the "to" visit
  retentionPct: number;
};

export type LocationInsight = {
  worst: LocationRetention;
  groupAvgPct: number;
  spread: number; // how far below the group average the worst location is
};

// Per-location retention at a given transition. Guests are attributed to the
// location of their FIRST visit (a regular at one store is a first-timer at
// another). Only locations with a big enough base are returned, sorted
// worst-first. Bounce Back is cross-location by design, but the drop-off may be
// concentrated at one store — this surfaces that.
export function locationDropoff(
  guests: GuestWithVisits[],
  locations: { id: string; name: string }[],
  fromVisit: number
): LocationRetention[] {
  const byLoc = new Map<string, GuestWithVisits[]>();
  for (const g of guests) {
    const loc = g.guest_visits.find((v) => v.visit_number === 1)?.location_id;
    if (!loc) continue;
    const arr = byLoc.get(loc);
    if (arr) arr.push(g);
    else byLoc.set(loc, [g]);
  }
  const rows: LocationRetention[] = [];
  for (const [locId, gs] of byLoc) {
    const reached = gs.filter((g) => stageOf(g.guest_visits) >= fromVisit).length;
    if (reached < MIN_STAGE_BASE) continue;
    const advanced = gs.filter((g) => stageOf(g.guest_visits) >= fromVisit + 1).length;
    rows.push({
      locationId: locId,
      name: locations.find((l) => l.id === locId)?.name ?? "Unknown",
      tracked: gs.length,
      reached,
      advanced,
      retentionPct: reached > 0 ? Math.round((advanced / reached) * 100) : 0,
    });
  }
  return rows.sort((a, b) => a.retentionPct - b.retentionPct);
}

// If one location's retention stands out as notably worse than the group, flag
// it. Needs at least two comparable locations and a ~10-point gap so we don't
// cry wolf over noise.
export function locationInsight(rows: LocationRetention[]): LocationInsight | null {
  if (rows.length < 2) return null;
  const groupAvgPct = Math.round(rows.reduce((s, r) => s + r.retentionPct, 0) / rows.length);
  const worst = rows[0]; // sorted worst-first
  const spread = groupAvgPct - worst.retentionPct;
  if (spread < 10) return null;
  return { worst, groupAvgPct, spread };
}

// Deterministic diagnostic questions per drop point, used as the fallback when
// AI generation is unavailable and as the shape the AI is asked to match.
export function fallbackQuestions(stage: DropStage): string[] {
  switch (stage.fromVisit) {
    case 1:
      return [
        "What does a first-time guest actually experience from the door to the goodbye — and does anyone flag them as new?",
        "Do you capture a first-timer's name or contact and give them a specific reason to come back before they leave?",
        "In the days after a first visit, does anything reach the guest — a thank-you, an invite, an offer?",
      ];
    case 2:
      return [
        "When a guest comes back a second time, does the team recognize them as a returning face — and does it change how they're treated?",
        "What's the bounce-back offer or hook that's supposed to pull them from a 2nd visit to a 3rd, and is it actually being handed out?",
        "Is anything different about the second visit from the first, or does it feel like starting over?",
      ];
    case 3:
      return [
        "These guests are on the edge of becoming regulars — does anyone treat them like a regular yet (name, usual, a personal touch)?",
        "Is there a moment where you invite near-regulars into something — a loyalty perk, an event, an ask to refer?",
        "What would make a 3rd-visit guest feel like this is 'their place' rather than just a good restaurant?",
      ];
    default:
      return [
        "Walk through what happens at this stage of a guest's journey today.",
        "What's supposed to pull a guest to the next visit, and is it consistently happening?",
        "Where do you think the experience is falling flat for these guests?",
      ];
  }
}
