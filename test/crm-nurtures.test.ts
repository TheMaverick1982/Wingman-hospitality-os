import { describe, it, expect } from "vitest";
import { NURTURE_SEQUENCES, RETIRED_SOURCES } from "@/lib/crm-nurtures";
import { renderMerge } from "@/lib/crm-merge";

// Data-integrity tests for every seeded automation. These guard the parts most
// likely to break silently: cadence, the activated/rescue conditions, which
// email is transactional, that no build/internal notes leaked into customer
// copy, and that every merge field a body uses actually resolves.

const bySource = Object.fromEntries(NURTURE_SEQUENCES.map((s) => [s.source, s]));

const EXPECTED: Record<string, { days: number[]; conds: string[]; transFirst: boolean }> = {
  demo: { days: [0, 1, 3, 6, 9, 13], conds: Array(6).fill("always"), transFirst: false },
  calculator: { days: [0, 1, 3, 6, 9, 13], conds: Array(6).fill("always"), transFirst: true },
  scorecard: { days: [0, 1, 3, 6, 9, 13], conds: Array(6).fill("always"), transFirst: true },
  signup: {
    days: [0, 1, 1, 3, 5, 5, 8, 8, 11, 14],
    conds: ["always", "always", "always", "always", "activated", "not_activated", "activated", "not_activated", "activated", "always"],
    transFirst: true,
  },
  "demo-no-show": { days: [0, 2], conds: ["always", "always"], transFirst: false },
  referral: { days: [30], conds: ["always"], transFirst: false },
};

describe("nurture sequence data integrity", () => {
  it("seeds exactly the expected sources", () => {
    expect(NURTURE_SEQUENCES.map((s) => s.source).sort()).toEqual(
      ["booked", "calculator", "demo", "demo-cancel", "demo-no-show", "reactivation", "referral", "scorecard", "signup"]
    );
    expect(RETIRED_SOURCES).toContain("sales-chat");
  });

  // Covers EVERY seeded automation (not just the ones with a cadence spec below),
  // so merge fields in newer sequences — booked, demo-cancel, reactivation — are
  // guarded too. A missing/blank field must fall back, never leave {{residue}} or
  // render "undefined".
  it("every merge field in every automation resolves cleanly", () => {
    for (const seq of NURTURE_SEQUENCES) {
      for (const step of seq.steps) {
        const rendered = renderMerge(step.subject + "\n" + step.body, { name: null, fields: {} });
        expect(rendered, `${seq.source} #${step.step_order} left {{residue}}`).not.toContain("{{");
        expect(rendered, `${seq.source} #${step.step_order} rendered "undefined"`).not.toContain("undefined");
      }
    }
  });

  for (const [source, exp] of Object.entries(EXPECTED)) {
    describe(source, () => {
      const seq = bySource[source];

      it("exists with contiguous step_order", () => {
        expect(seq, `sequence ${source} missing`).toBeTruthy();
        expect(seq.steps.map((s) => s.step_order)).toEqual(seq.steps.map((_, i) => i + 1));
      });

      it("matches the spec cadence", () => {
        expect(seq.steps.map((s) => s.delay_days)).toEqual(exp.days);
      });

      it("matches the spec send conditions", () => {
        expect(seq.steps.map((s) => s.send_condition)).toEqual(exp.conds);
      });

      it("only the first email is transactional (when expected)", () => {
        expect(seq.steps[0].transactional).toBe(exp.transFirst);
        expect(seq.steps.slice(1).every((s) => s.transactional === false)).toBe(true);
      });

      it("contains no build/internal notes in customer copy", () => {
        for (const step of seq.steps) {
          const hay = `${step.subject}\n${step.body}`;
          expect(hay, `${source} #${step.step_order}`).not.toMatch(/build note|\bGHL\b|webhook|merge tag|until wired/i);
        }
      });

      it("every merge field resolves (no residue, no undefined)", () => {
        for (const step of seq.steps) {
          const rendered = renderMerge(step.subject + "\n" + step.body, { name: null, fields: {} });
          expect(rendered, `${source} #${step.step_order}`).not.toContain("{{");
          expect(rendered, `${source} #${step.step_order}`).not.toContain("undefined");
        }
      });
    });
  }
});
