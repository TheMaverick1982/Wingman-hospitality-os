import { describe, it, expect } from "vitest";
import { computeGuestRevenue } from "@/lib/guest-revenue";
import type { GuestWithVisits } from "@/lib/hospitality";

function guest(id: string, visits: { visit_number: number; visit_date: string | null; bill_total?: number | null }[]): GuestWithVisits {
  return {
    id,
    name: id,
    phone: "",
    email: "",
    guest_visits: visits.map((v) => ({ ...v, location_id: null, incentive: null, notes: null })),
  };
}

describe("computeGuestRevenue", () => {
  it("splits revenue by visit and separates first-visit from repeat revenue", () => {
    const guests = [
      guest("a", [
        { visit_number: 1, visit_date: "2026-01-01", bill_total: 40 },
        { visit_number: 2, visit_date: "2026-01-10", bill_total: 60 },
      ]),
      guest("b", [{ visit_number: 1, visit_date: "2026-01-02", bill_total: 20 }]),
    ];
    const r = computeGuestRevenue(guests);
    expect(r.byVisit[0].total).toBe(60); // visit 1: 40 + 20
    expect(r.byVisit[1].total).toBe(60); // visit 2: 60
    expect(r.firstVisitRevenue).toBe(60);
    expect(r.repeatRevenue).toBe(60);
    expect(r.total).toBe(120);
    expect(r.billedVisits).toBe(3);
    expect(r.avgCheck).toBe(40); // 120 / 3
  });

  it("ignores null, zero, and negative bills", () => {
    const guests = [
      guest("a", [
        { visit_number: 1, visit_date: "2026-01-01", bill_total: null },
        { visit_number: 2, visit_date: "2026-01-02", bill_total: 0 },
        { visit_number: 3, visit_date: "2026-01-03", bill_total: -5 },
        { visit_number: 4, visit_date: "2026-01-04", bill_total: 50 },
      ]),
    ];
    const r = computeGuestRevenue(guests);
    expect(r.total).toBe(50);
    expect(r.billedVisits).toBe(1);
    expect(r.byVisit[3].total).toBe(50);
  });

  it("respects a since cutoff on visit_date", () => {
    const guests = [
      guest("a", [
        { visit_number: 1, visit_date: "2026-01-01", bill_total: 40 },
        { visit_number: 2, visit_date: "2026-02-01", bill_total: 60 },
      ]),
    ];
    const r = computeGuestRevenue(guests, "2026-01-15");
    expect(r.total).toBe(60); // only the Feb visit counts
    expect(r.byVisit[0].total).toBe(0);
  });

  it("returns zeros for no billed visits", () => {
    const r = computeGuestRevenue([guest("a", [{ visit_number: 1, visit_date: "2026-01-01" }])]);
    expect(r.total).toBe(0);
    expect(r.billedVisits).toBe(0);
    expect(r.avgCheck).toBe(0);
  });
});
