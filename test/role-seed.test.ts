import { describe, it, expect } from "vitest";
import { ROLE_SEED } from "@/lib/role-seed";
import { ALL_DEPARTMENTS } from "@/lib/constants";

describe("ROLE_SEED", () => {
  it("covers every built-in department", () => {
    for (const d of ALL_DEPARTMENTS) {
      expect(ROLE_SEED[d], `missing seed for ${d}`).toBeTruthy();
    }
    // No stray keys beyond the known departments.
    expect(Object.keys(ROLE_SEED).sort()).toEqual([...ALL_DEPARTMENTS].sort());
  });

  it("gives every role non-empty starter content", () => {
    for (const d of ALL_DEPARTMENTS) {
      const seed = ROLE_SEED[d];
      expect(seed.trackLabel.length, `${d} trackLabel`).toBeGreaterThan(0);
      expect(seed.standards.length, `${d} standards`).toBeGreaterThan(0);
      expect(seed.duties.length, `${d} duties`).toBeGreaterThan(0);
      expect(seed.hiring.length, `${d} hiring`).toBeGreaterThan(0);
    }
  });

  it("every hiring trait has a question, green flag, and red flag", () => {
    for (const d of ALL_DEPARTMENTS) {
      for (const h of ROLE_SEED[d].hiring) {
        expect(h.title.length, `${d} trait title`).toBeGreaterThan(0);
        expect(h.question.length, `${d} question`).toBeGreaterThan(0);
        expect(h.green_flag.length, `${d} green flag`).toBeGreaterThan(0);
        expect(h.red_flag.length, `${d} red flag`).toBeGreaterThan(0);
      }
    }
  });
});
