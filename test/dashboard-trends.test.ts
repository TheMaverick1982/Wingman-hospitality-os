import { describe, it, expect } from "vitest";
import { weeklyBuckets, thisVsLast, repeatRateAsOf, repeatRateSeries } from "@/lib/dashboard-trends";
import type { GuestWithVisits } from "@/lib/hospitality";

const DAY = 86400000;
const WEEK = 7 * DAY;
const NOW = 1_700_000_000_000; // fixed "now" for deterministic bucketing

function iso(ms: number) {
  return new Date(ms).toISOString();
}

describe("weeklyBuckets", () => {
  it("buckets dates into weeks with the current week last", () => {
    const dates = [
      iso(NOW - 1 * DAY), // this week
      iso(NOW - 2 * DAY), // this week
      iso(NOW - 8 * DAY), // last week
      iso(NOW - 20 * DAY), // 2–3 weeks ago
    ];
    const b = weeklyBuckets(dates, NOW, 4);
    expect(b).toHaveLength(4);
    expect(b[3]).toBe(2); // this week
    expect(b[2]).toBe(1); // last week
    expect(b.reduce((s, n) => s + n, 0)).toBe(4);
  });

  it("ignores out-of-range and unparseable dates", () => {
    const b = weeklyBuckets([iso(NOW - 100 * DAY), "not-a-date", null, undefined], NOW, 4);
    expect(b).toEqual([0, 0, 0, 0]);
  });
});

describe("thisVsLast", () => {
  it("returns this week's value and the change vs last week", () => {
    expect(thisVsLast([1, 2, 5, 9])).toEqual({ thisWeek: 9, delta: 4 });
    expect(thisVsLast([9, 4])).toEqual({ thisWeek: 4, delta: -5 });
    expect(thisVsLast([])).toEqual({ thisWeek: 0, delta: 0 });
  });
});

describe("repeatRateAsOf", () => {
  const guests: GuestWithVisits[] = [
    // came back for a 2nd visit last week
    { id: "a", guest_visits: [{ visit_number: 1, visit_date: iso(NOW - 20 * DAY) }, { visit_number: 2, visit_date: iso(NOW - 6 * DAY) }] } as GuestWithVisits,
    // only one visit
    { id: "b", guest_visits: [{ visit_number: 1, visit_date: iso(NOW - 20 * DAY) }] } as GuestWithVisits,
  ];

  it("reflects the rate at a cutoff (2nd visit not yet counted)", () => {
    // Two weeks ago: both guests exist, neither has a 2nd visit yet → 0%.
    expect(repeatRateAsOf(guests, NOW - 14 * DAY)).toBe(0);
  });

  it("counts the 2nd visit once it has happened", () => {
    // Now: guest A is back for visit 2 → 1 of 2 = 50%.
    expect(repeatRateAsOf(guests, NOW)).toBe(50);
  });

  it("excludes guests with no first visit by the cutoff", () => {
    const future: GuestWithVisits[] = [
      { id: "c", guest_visits: [{ visit_number: 1, visit_date: iso(NOW - 2 * DAY) }] } as GuestWithVisits,
    ];
    expect(repeatRateAsOf(future, NOW - 10 * DAY)).toBe(0); // not a guest yet 10 days ago
  });

  it("series has one entry per week ending at now", () => {
    expect(repeatRateSeries(guests, NOW, 6)).toHaveLength(6);
  });
});
