import { describe, it, expect } from "vitest";
import { computeMomentum, ACTIVE_WEEK_MIN, type HabitKey } from "@/lib/momentum";

const DAY = 86400000;
const NOW = 1_700_000_000_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

const empty = (): Record<HabitKey, string[]> => ({
  floorChecks: [],
  guestLogging: [],
  checklists: [],
  recognition: [],
  training: [],
});

describe("computeMomentum", () => {
  it("cold + stalled when nothing happened this week", () => {
    const m = computeMomentum(empty(), NOW);
    expect(m.score).toBe(0);
    expect(m.activeHabits).toBe(0);
    expect(m.label).toBe("Cold");
    expect(m.stalled).toBe(true);
    expect(m.streakWeeks).toBe(0);
    expect(m.topGap?.key).toBe("floorChecks"); // highest-priority gap
  });

  it("counts this-week actions and picks a label", () => {
    const d = empty();
    d.floorChecks = [daysAgo(1)];
    d.guestLogging = [daysAgo(2), daysAgo(3)];
    d.recognition = [daysAgo(0)];
    const m = computeMomentum(d, NOW);
    expect(m.activeHabits).toBe(3);
    expect(m.score).toBe(60);
    expect(m.label).toBe("Strong");
    expect(m.stalled).toBe(false);
    // checklists is the first inactive habit in priority order after the active ones
    expect(m.topGap?.key).toBe("checklists");
  });

  it("all habits active => On fire, no gap", () => {
    const d = empty();
    (Object.keys(d) as HabitKey[]).forEach((k) => (d[k] = [daysAgo(1)]));
    const m = computeMomentum(d, NOW);
    expect(m.activeHabits).toBe(5);
    expect(m.score).toBe(100);
    expect(m.label).toBe("On fire");
    expect(m.topGap).toBeNull();
  });

  it("does not count actions older than 7 days toward this week", () => {
    const d = empty();
    d.floorChecks = [daysAgo(8)]; // last week, not this
    const m = computeMomentum(d, NOW);
    expect(m.habits.find((h) => h.key === "floorChecks")?.active).toBe(false);
  });

  it("builds a streak from prior full weeks at/above the active bar", () => {
    const d = empty();
    // Weeks 1, 2, 3 each get 2 habits; week 4 gets only 1 (breaks the streak).
    for (const w of [1, 2, 3]) {
      const mid = w * 7 + 3; // squarely inside week w's window
      d.floorChecks.push(daysAgo(mid));
      d.guestLogging.push(daysAgo(mid));
    }
    d.training.push(daysAgo(4 * 7 + 3)); // week 4: only 1 habit
    const m = computeMomentum(d, NOW);
    expect(ACTIVE_WEEK_MIN).toBe(2);
    expect(m.streakWeeks).toBe(3);
  });

  it("streak stops at the first week below the bar", () => {
    const d = empty();
    // Week 1 strong, week 2 empty => streak is just 1.
    d.floorChecks.push(daysAgo(1 * 7 + 3));
    d.guestLogging.push(daysAgo(1 * 7 + 3));
    d.floorChecks.push(daysAgo(3 * 7 + 3)); // week 3 has activity but week 2 gap breaks it
    d.guestLogging.push(daysAgo(3 * 7 + 3));
    const m = computeMomentum(d, NOW);
    expect(m.streakWeeks).toBe(1);
  });
});
