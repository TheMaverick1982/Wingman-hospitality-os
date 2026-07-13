// The ROI ledger — dollars tied to the guest work they've actually done, and the
// money still on the table. It reuses the exact model behind the public ROI
// calculator: a converted regular is worth (visits/year − 1) × average check in
// incremental annual revenue. Real account data in, real numbers out.

export const DEFAULT_AVG_CHECK = 40;
// A "regular" here is modeled as a roughly-monthly guest. Conservative on
// purpose, and shown as an assumption the owner can refine with their own check.
export const DEFAULT_VISITS_PER_YEAR = 12;
// What we credit against the at-risk pool for the "even converting a slice"
// framing — deliberately modest so the number is defensible, never hype.
export const CONVERT_SHARE = 0.25;

export type RoiLedgerInput = {
  returnedRegulars: number; // guests who came back at least once (stage >= 2)
  atRiskFirstTimers: number; // one-and-done first-timers past their return window
  avgCheck: number;
  visitsPerYear: number;
  usingDefaultCheck: boolean; // avgCheck fell back to the default (not their number)
};

export type RoiLedger = {
  perRegularAnnual: number;
  capturedAnnual: number; // run-rate value of the regulars they've won back
  atRiskAnnual: number; // full annual value of the one-and-done pool
  convertShare: number;
  convertUpsideAnnual: number; // atRiskAnnual × convertShare
  returnedRegulars: number;
  atRiskFirstTimers: number;
  avgCheck: number;
  visitsPerYear: number;
  usingDefaultCheck: boolean;
};

export function computeRoiLedger(input: RoiLedgerInput): RoiLedger {
  const perRegularAnnual = Math.max(0, input.visitsPerYear - 1) * input.avgCheck;
  const capturedAnnual = Math.round(input.returnedRegulars * perRegularAnnual);
  const atRiskAnnual = Math.round(input.atRiskFirstTimers * perRegularAnnual);
  const convertUpsideAnnual = Math.round(atRiskAnnual * CONVERT_SHARE);
  return {
    perRegularAnnual: Math.round(perRegularAnnual),
    capturedAnnual,
    atRiskAnnual,
    convertShare: CONVERT_SHARE,
    convertUpsideAnnual,
    returnedRegulars: input.returnedRegulars,
    atRiskFirstTimers: input.atRiskFirstTimers,
    avgCheck: input.avgCheck,
    visitsPerYear: input.visitsPerYear,
    usingDefaultCheck: input.usingDefaultCheck,
  };
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
