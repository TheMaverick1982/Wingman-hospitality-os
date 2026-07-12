import { describe, it, expect } from "vitest";
import { monthlyRepeatCohorts, bizHealthTrend, monthlyTrainingCompletion } from "@/lib/reporting-trends";

describe("monthlyRepeatCohorts", () => {
  const now = new Date(2026, 5, 15); // Jun 15 2026

  it("returns one bucket per month in the window, oldest first", () => {
    const out = monthlyRepeatCohorts([], now, 6);
    expect(out.map((c) => c.label)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
    expect(out.every((c) => c.newGuests === 0 && c.repeatPct === 0)).toBe(true);
  });

  it("assigns a guest to their visit-1 cohort month and counts returns", () => {
    const guests = [
      // Feb first-timer who came back → returned
      { guest_visits: [{ visit_number: 1, visit_date: "2026-02-03" }, { visit_number: 2, visit_date: "2026-02-20" }] },
      // Feb first-timer who never returned
      { guest_visits: [{ visit_number: 1, visit_date: "2026-02-10" }] },
      // May first-timer who returned
      { guest_visits: [{ visit_number: 1, visit_date: "2026-05-01" }, { visit_number: 3, visit_date: "2026-06-01" }] },
    ];
    const out = monthlyRepeatCohorts(guests, now, 6);
    const feb = out.find((c) => c.label === "Feb")!;
    expect(feb.newGuests).toBe(2);
    expect(feb.returned).toBe(1);
    expect(feb.repeatPct).toBe(50);
    const may = out.find((c) => c.label === "May")!;
    expect(may.repeatPct).toBe(100);
  });

  it("ignores guests whose visit 1 falls outside the window", () => {
    const guests = [{ guest_visits: [{ visit_number: 1, visit_date: "2025-01-01" }] }];
    const out = monthlyRepeatCohorts(guests, now, 6);
    expect(out.reduce((s, c) => s + c.newGuests, 0)).toBe(0);
  });
});

describe("monthlyTrainingCompletion", () => {
  const now = new Date(2026, 5, 15);
  it("averages completion per month and seeds empty months", () => {
    const out = monthlyTrainingCompletion(
      [
        { completion_pct: 80, occurred_on: "2026-05-02" },
        { completion_pct: 100, occurred_on: "2026-05-20" },
      ],
      now,
      6
    );
    expect(out).toHaveLength(6);
    const may = out.find((m) => m.label === "May")!;
    expect(may.avgCompletion).toBe(90);
    expect(may.count).toBe(2);
    const jan = out.find((m) => m.label === "Jan")!;
    expect(jan).toMatchObject({ avgCompletion: 0, count: 0 });
  });
});

describe("bizHealthTrend", () => {
  it("computes labor %, avg check, comp % and sorts oldest first", () => {
    const rows = [
      { period_date: "2026-06-08", net_sales: 10000, labor_cost: 3000, comp_cost: 200, checks: 400 },
      { period_date: "2026-06-01", net_sales: 8000, labor_cost: 2400, comp_cost: 80, checks: 320 },
    ];
    const out = bizHealthTrend(rows);
    expect(out.map((p) => p.label)).toEqual(["6/1", "6/8"]);
    expect(out[0].laborPct).toBe(30);
    expect(out[0].avgCheck).toBe(25);
    expect(out[1].compPct).toBe(2);
  });

  it("guards divide-by-zero", () => {
    const out = bizHealthTrend([{ period_date: "2026-06-01", net_sales: 0, labor_cost: 0, comp_cost: 0, checks: 0 }]);
    expect(out[0]).toMatchObject({ laborPct: 0, avgCheck: 0, compPct: 0 });
  });
});
