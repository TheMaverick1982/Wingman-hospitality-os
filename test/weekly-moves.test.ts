import { describe, it, expect } from "vitest";
import { weekStartOf, normalizeMoves, mergeDone, parseMoves, MAX_MOVES } from "@/lib/weekly-moves";

const at = (iso: string) => new Date(iso).getTime();

describe("weekStartOf", () => {
  it("returns the Monday of the week (UTC)", () => {
    expect(weekStartOf(at("2026-07-15T12:00:00Z"))).toBe("2026-07-13"); // Wed -> Mon 13th
    expect(weekStartOf(at("2026-07-13T00:00:00Z"))).toBe("2026-07-13"); // Mon -> itself
  });
  it("rolls Sunday back to the prior Monday", () => {
    expect(weekStartOf(at("2026-07-19T23:00:00Z"))).toBe("2026-07-13"); // Sun -> Mon 13th
  });
});

describe("normalizeMoves", () => {
  it("trims, drops empties, caps at MAX_MOVES, marks not-done", () => {
    const moves = normalizeMoves(["  a ", "", "b", "c", "d"]);
    expect(moves).toHaveLength(MAX_MOVES);
    expect(moves.map((m) => m.text)).toEqual(["a", "b", "c"]);
    expect(moves.every((m) => m.done === false)).toBe(true);
  });
});

describe("mergeDone", () => {
  it("carries done state forward for unchanged text only", () => {
    const prev = [
      { text: "keep", done: true },
      { text: "drop", done: true },
    ];
    const next = normalizeMoves(["keep", "new"]);
    const merged = mergeDone(next, prev);
    expect(merged.find((m) => m.text === "keep")?.done).toBe(true);
    expect(merged.find((m) => m.text === "new")?.done).toBe(false);
  });
});

describe("parseMoves", () => {
  it("reads jsonb rows defensively", () => {
    expect(parseMoves(null)).toEqual([]);
    expect(parseMoves([{ text: " x ", done: 1 }, { text: "" }, { nope: true }])).toEqual([{ text: "x", done: true }]);
  });
});
