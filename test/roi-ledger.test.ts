import { describe, it, expect } from "vitest";
import { computeRoiLedger, CONVERT_SHARE, DEFAULT_VISITS_PER_YEAR } from "@/lib/roi-ledger";

describe("computeRoiLedger", () => {
  it("values a regular at (visits/year - 1) * avg check", () => {
    const r = computeRoiLedger({ returnedRegulars: 10, atRiskFirstTimers: 0, avgCheck: 50, visitsPerYear: 12, usingDefaultCheck: false });
    expect(r.perRegularAnnual).toBe(11 * 50); // 550
    expect(r.capturedAnnual).toBe(10 * 550);
    expect(r.atRiskAnnual).toBe(0);
    expect(r.convertUpsideAnnual).toBe(0);
  });

  it("computes the at-risk pool and the modest-conversion upside", () => {
    const r = computeRoiLedger({ returnedRegulars: 0, atRiskFirstTimers: 40, avgCheck: 40, visitsPerYear: 12, usingDefaultCheck: true });
    const perRegular = 11 * 40; // 440
    expect(r.atRiskAnnual).toBe(40 * perRegular);
    expect(r.convertShare).toBe(CONVERT_SHARE);
    expect(r.convertUpsideAnnual).toBe(Math.round(40 * perRegular * CONVERT_SHARE));
    expect(r.usingDefaultCheck).toBe(true);
  });

  it("never goes negative when visits/year is 1 or less", () => {
    const r = computeRoiLedger({ returnedRegulars: 5, atRiskFirstTimers: 5, avgCheck: 60, visitsPerYear: 1, usingDefaultCheck: false });
    expect(r.perRegularAnnual).toBe(0);
    expect(r.capturedAnnual).toBe(0);
    expect(r.atRiskAnnual).toBe(0);
  });

  it("passes through the inputs used for display", () => {
    const r = computeRoiLedger({ returnedRegulars: 3, atRiskFirstTimers: 7, avgCheck: 45, visitsPerYear: DEFAULT_VISITS_PER_YEAR, usingDefaultCheck: false });
    expect(r.returnedRegulars).toBe(3);
    expect(r.atRiskFirstTimers).toBe(7);
    expect(r.avgCheck).toBe(45);
    expect(r.visitsPerYear).toBe(DEFAULT_VISITS_PER_YEAR);
  });
});
