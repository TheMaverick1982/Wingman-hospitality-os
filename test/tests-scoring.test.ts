import { describe, it, expect } from "vitest";
import { scoreTest, completionWindowLabel, resolveAttempt } from "@/lib/tests";

describe("scoreTest", () => {
  const qs = [
    { id: "a", correct_index: 1 },
    { id: "b", correct_index: 0 },
    { id: "c", correct_index: 2 },
    { id: "d", correct_index: 0 },
  ];

  it("scores correct answers and computes the percentage", () => {
    const r = scoreTest(qs, { a: 1, b: 0, c: 2, d: 1 }); // 3/4 correct
    expect(r.correct).toBe(3);
    expect(r.total).toBe(4);
    expect(r.pct).toBe(75);
  });

  it("counts an unanswered question as wrong", () => {
    const r = scoreTest(qs, { a: 1, b: 0 }); // 2 answered correct, 2 missing
    expect(r.correct).toBe(2);
    expect(r.pct).toBe(50);
  });

  it("is 100% when all correct and 0% when none", () => {
    expect(scoreTest(qs, { a: 1, b: 0, c: 2, d: 0 }).pct).toBe(100);
    expect(scoreTest(qs, { a: 0, b: 1, c: 0, d: 1 }).pct).toBe(0);
  });

  it("returns 0% for an empty test", () => {
    expect(scoreTest([], {}).pct).toBe(0);
  });
});

describe("resolveAttempt", () => {
  it("passes when the score meets the mark", () => {
    expect(resolveAttempt(80, 80, 1, 1)).toEqual({ passed: true, locked: false, retake: false });
  });
  it("allows a retake while attempts remain", () => {
    // 1 retake => 2 attempts allowed. After the first failed attempt, retake.
    expect(resolveAttempt(50, 80, 1, 1)).toEqual({ passed: false, locked: false, retake: true });
  });
  it("locks once all attempts are used", () => {
    // After the 2nd failed attempt (attemptsUsed=2, allowed=2), lock.
    expect(resolveAttempt(50, 80, 2, 1)).toEqual({ passed: false, locked: true, retake: false });
  });
  it("locks after one attempt when no retakes are allowed", () => {
    expect(resolveAttempt(50, 80, 1, 0)).toEqual({ passed: false, locked: true, retake: false });
  });
});

describe("completionWindowLabel", () => {
  it("formats deadlines and handles none", () => {
    expect(completionWindowLabel(null, "days")).toBe("No deadline");
    expect(completionWindowLabel(1, "day" as "days")).toBe("1 day to complete");
    expect(completionWindowLabel(5, "days")).toBe("5 days to complete");
    expect(completionWindowLabel(48, "hours")).toBe("48 hours to complete");
  });
});
