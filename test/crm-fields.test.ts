import { describe, it, expect } from "vitest";
import { contactFieldsFromLead } from "@/lib/crm";

describe("contactFieldsFromLead", () => {
  it("maps the calculator's current landing-page payload to calc_* fields", () => {
    const f = contactFieldsFromLead("calculator", {
      guests: 200,
      check: 45,
      current: 20,
      target: 35,
      visits: 6,
      perYear: 120000,
    });
    expect(f.calc_new_guests_month).toBe(200);
    expect(f.calc_avg_check).toBe(45);
    expect(f.calc_current_repeat_rate).toBe(20);
    expect(f.calc_target_repeat_rate).toBe(35);
    expect(f.calc_annual_upside).toBe(120000);
    // Monthly is derived from annual when not supplied.
    expect(f.calc_monthly_upside).toBe(10000);
  });

  it("prefers explicit monthly_upside and the spec field keys", () => {
    const f = contactFieldsFromLead("calculator", {
      new_guests_month: 150,
      avg_check: 60,
      annual_upside: 90000,
      monthly_upside: 7500,
    });
    expect(f.calc_new_guests_month).toBe(150);
    expect(f.calc_avg_check).toBe(60);
    expect(f.calc_annual_upside).toBe(90000);
    expect(f.calc_monthly_upside).toBe(7500);
  });

  it("maps the scorecard score + three gaps", () => {
    const f = contactFieldsFromLead("scorecard", {
      score: 7,
      gap_1: "Retention tracking",
      gap_2: "Accountability",
      gap_3: "Measurement",
    });
    expect(f.scorecard_score).toBe(7);
    expect(f.scorecard_gap_1).toBe("Retention tracking");
    expect(f.scorecard_gap_2).toBe("Accountability");
    expect(f.scorecard_gap_3).toBe("Measurement");
  });

  it("drops undefined fields so merges fall back cleanly", () => {
    const f = contactFieldsFromLead("scorecard", { score: 5 });
    expect("scorecard_gap_1" in f).toBe(false);
    expect(f.scorecard_score).toBe(5);
  });
});
