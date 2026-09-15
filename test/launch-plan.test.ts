import { describe, it, expect } from "vitest";
import { computeLaunchPlan, LAUNCH_TOTAL_DAYS, type LaunchSignals } from "@/lib/launch-plan";

const NONE: LaunchSignals = {
  wizard: false,
  training: false,
  staff: false,
  hiring: false,
  playbook: false,
  firstGuest: false,
  culture: false,
  spotCheck: false,
};
const ALL: LaunchSignals = {
  wizard: true,
  training: true,
  staff: true,
  hiring: true,
  playbook: true,
  firstGuest: true,
  culture: true,
  spotCheck: true,
};

const DAY_MS = 86400000;
// A fixed "now"; created N days earlier => dayNumber ~ N+1.
const NOW = 1_700_000_000_000;
const createdDaysAgo = (n: number) => NOW - n * DAY_MS;

describe("computeLaunchPlan", () => {
  it("day 1 for a brand-new org, nothing overdue yet", () => {
    const p = computeLaunchPlan(NONE, createdDaysAgo(0), NOW);
    expect(p.dayNumber).toBe(1);
    expect(p.totalDays).toBe(LAUNCH_TOTAL_DAYS);
    expect(p.overdueCount).toBe(0);
    expect(p.onTrack).toBe(true);
    expect(p.allDone).toBe(false);
  });

  it("counts everything done and reports allDone", () => {
    const p = computeLaunchPlan(ALL, createdDaysAgo(3), NOW);
    expect(p.doneCount).toBe(p.totalCount);
    expect(p.allDone).toBe(true);
    expect(p.onTrack).toBe(true);
    expect(p.nextActions).toHaveLength(0);
  });

  it("never scolds: past-due milestones read 'due', never 'overdue'", () => {
    // Day ~11: every phase up to "guests" has started, so those milestones are
    // "due" (do it when ready) — but nothing is ever marked "overdue".
    const p = computeLaunchPlan(NONE, createdDaysAgo(10), NOW);
    expect(p.dayNumber).toBe(11);
    expect(p.overdueCount).toBe(0);
    expect(p.onTrack).toBe(true);
    const byKey = Object.fromEntries(p.phases.flatMap((ph) => ph.milestones).map((m) => [m.key, m]));
    expect(byKey.wizard.status).toBe("due");
    expect(byKey.culture.status).toBe("due");
    expect(byKey.spotCheck.status).toBe("upcoming"); // habit phase starts day 12; still day 11
  });

  it("reports setup progress separately from usage milestones", () => {
    // Setup milestones: wizard, training, staff, hiring, playbook (5). Mark the
    // usage ones done but no setup done -> setupDoneCount 0, setupAllDone false.
    const usageOnly = { ...NONE, firstGuest: true, culture: true, spotCheck: true };
    const p = computeLaunchPlan(usageOnly, createdDaysAgo(1), NOW);
    expect(p.setupTotalCount).toBe(5);
    expect(p.setupDoneCount).toBe(0);
    expect(p.setupAllDone).toBe(false);

    const setupDone = { ...NONE, wizard: true, training: true, staff: true, hiring: true, playbook: true };
    const q = computeLaunchPlan(setupDone, createdDaysAgo(1), NOW);
    expect(q.setupDoneCount).toBe(5);
    expect(q.setupAllDone).toBe(true);
    expect(q.allDone).toBe(false); // usage milestones still open
  });

  it("upcoming before a phase starts, due within the window", () => {
    const p = computeLaunchPlan(NONE, createdDaysAgo(0), NOW); // day 1
    const byKey = Object.fromEntries(p.phases.flatMap((ph) => ph.milestones).map((m) => [m.key, m]));
    expect(byKey.wizard.status).toBe("due"); // phase starts day 1
    expect(byKey.staff.status).toBe("upcoming"); // team phase starts day 4
    expect(byKey.spotCheck.status).toBe("upcoming"); // habit phase starts day 12
  });

  it("nextActions returns up to 3 undone, earliest target first", () => {
    const signals = { ...NONE, wizard: true }; // wizard done
    const p = computeLaunchPlan(signals, createdDaysAgo(1), NOW);
    expect(p.nextActions.map((m) => m.key)).toEqual(["training", "staff", "hiring"]);
  });

  it("every phase window is covered and milestones are grouped correctly", () => {
    const p = computeLaunchPlan(NONE, createdDaysAgo(0), NOW);
    expect(p.phases.map((ph) => ph.key)).toEqual(["foundation", "team", "guests", "habit"]);
    expect(p.phases.every((ph) => ph.milestones.length > 0)).toBe(true);
  });
});
