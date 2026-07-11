import { describe, it, expect } from "vitest";
import { resolveStep, type ResolvableStep } from "@/lib/crm-step-resolver";

const DAY = 86_400_000;

// The signup onboarding (wf-05) step layout: three shared emails, then the
// day-5/8/11 activated-vs-rescue split, converging on the day-14 email.
const SIGNUP: ResolvableStep[] = [
  { step_order: 1, delay_days: 0, send_condition: "always" },
  { step_order: 2, delay_days: 1, send_condition: "always" },
  { step_order: 3, delay_days: 3, send_condition: "always" },
  { step_order: 4, delay_days: 5, send_condition: "activated" },
  { step_order: 5, delay_days: 5, send_condition: "not_activated" },
  { step_order: 6, delay_days: 8, send_condition: "activated" },
  { step_order: 7, delay_days: 8, send_condition: "not_activated" },
  { step_order: 8, delay_days: 11, send_condition: "activated" },
  { step_order: 9, delay_days: 14, send_condition: "always" },
];

const NURTURE: ResolvableStep[] = [0, 1, 3, 6, 9, 13].map((d, i) => ({
  step_order: i + 1,
  delay_days: d,
  send_condition: "always",
}));

describe("resolveStep — signup activated/rescue branch", () => {
  it("day 5, activated → sends the main-path email (step 4)", () => {
    const d = resolveStep(SIGNUP, 4, 5 * DAY, true);
    expect(d).toMatchObject({ action: "send", step: { step_order: 4 } });
  });

  it("day 5, not activated → sends the rescue email (step 5)", () => {
    const d = resolveStep(SIGNUP, 4, 5 * DAY, false);
    expect(d).toMatchObject({ action: "send", step: { step_order: 5 } });
  });

  it("day 8, activated → main path continues (step 6), rescue skipped", () => {
    const d = resolveStep(SIGNUP, 6, 8 * DAY, true);
    expect(d).toMatchObject({ action: "send", step: { step_order: 6 } });
  });

  it("day 8, not activated → rescue continues (step 7)", () => {
    const d = resolveStep(SIGNUP, 6, 8 * DAY, false);
    expect(d).toMatchObject({ action: "send", step: { step_order: 7 } });
  });

  it("rescue-then-activated: at day 8 they rejoin the activated arm (step 6)", () => {
    // They got the rescue email at day 5 (next_step_order advanced to 6), then
    // activated before day 8.
    const d = resolveStep(SIGNUP, 6, 8 * DAY, true);
    expect(d).toMatchObject({ action: "send", step: { step_order: 6 } });
  });

  it("day 11, not activated → skips the activated-only step and reschedules for day 14", () => {
    const d = resolveStep(SIGNUP, 8, 11 * DAY, false);
    expect(d).toEqual({ action: "reschedule", atMs: 14 * DAY, nextOrder: 9 });
  });

  it("day 11, activated → sends step 8", () => {
    const d = resolveStep(SIGNUP, 8, 11 * DAY, true);
    expect(d).toMatchObject({ action: "send", step: { step_order: 8 } });
  });

  it("day 14 → both arms converge on the final always email (step 9)", () => {
    expect(resolveStep(SIGNUP, 9, 14 * DAY, true)).toMatchObject({ action: "send", step: { step_order: 9 } });
    expect(resolveStep(SIGNUP, 9, 14 * DAY, false)).toMatchObject({ action: "send", step: { step_order: 9 } });
  });

  it("past the last step → completes", () => {
    expect(resolveStep(SIGNUP, 10, 99 * DAY, true)).toEqual({ action: "complete", lastOrder: 10 });
  });
});

describe("resolveStep — plain nurture cadence", () => {
  it("sends the day-0 email immediately on enrollment", () => {
    expect(resolveStep(NURTURE, 1, 0, false)).toMatchObject({ action: "send", step: { step_order: 1 } });
  });

  it("reschedules when the next step isn't due yet", () => {
    // step 1 sent, pointer at 2 (day 1), but only a few hours have passed.
    const d = resolveStep(NURTURE, 2, 3 * 3600 * 1000, false);
    expect(d).toEqual({ action: "reschedule", atMs: 1 * DAY, nextOrder: 2 });
  });

  it("completes after the final email is past", () => {
    expect(resolveStep(NURTURE, 7, 30 * DAY, false)).toEqual({ action: "complete", lastOrder: 7 });
  });
});
