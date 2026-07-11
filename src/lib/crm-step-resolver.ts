// Pure step-resolution for the CRM sequence cron. Given a contact's position in
// a sequence, how old their enrollment is, and whether they're "activated",
// decide what to do next: send a step, reschedule for when the next step is due,
// or complete the enrollment. Kept dependency-free so the activated/not_activated
// branch logic (wf-05 onboarding) is unit-testable without a database.

export type ResolvableStep = {
  step_order: number;
  delay_days: number;
  send_condition: string; // "always" | "activated" | "not_activated"
};

export type StepDecision =
  | { action: "send"; step: ResolvableStep }
  | { action: "reschedule"; atMs: number; nextOrder: number }
  | { action: "complete"; lastOrder: number };

const DAY_MS = 86_400_000;

// `steps` must be sorted by step_order ascending. `ageMs` is now - enrolled_at.
// A conditional step whose condition doesn't match the contact's activation is
// skipped (the "other arm" of a branch day); the resolver advances past it.
export function resolveStep(steps: ResolvableStep[], fromOrder: number, ageMs: number, activated: boolean): StepDecision {
  let ptr = fromOrder;
  for (;;) {
    const step = steps.find((s) => s.step_order >= ptr);
    if (!step) return { action: "complete", lastOrder: ptr };

    const dueAtMs = step.delay_days * DAY_MS;
    if (dueAtMs > ageMs) return { action: "reschedule", atMs: dueAtMs, nextOrder: step.step_order };

    if (step.send_condition !== "always") {
      const ok = step.send_condition === "activated" ? activated : !activated;
      if (!ok) {
        ptr = step.step_order + 1;
        continue;
      }
    }
    return { action: "send", step };
  }
}
