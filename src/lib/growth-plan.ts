export type GrowthFrequency = "weekly" | "monthly";

export type GrowthBaseline = {
  customers: number;
  avgSale: number;
  repurchaseFrequency: number;
};

export type GrowthPhase = {
  label: string;
  sublabel?: string;
  customers: number;
  avgSale: number;
  repurchaseFrequency: number;
  total: number;
  pctIncreaseVsBase: number;
};

function computeTotal(b: GrowthBaseline): number {
  return b.customers * b.avgSale * b.repurchaseFrequency;
}

function applyGrowth(base: GrowthBaseline, pctCustomers: number, pctAvgSale: number, pctFrequency: number, label: string, sublabel?: string): GrowthPhase {
  const customers = base.customers * (1 + pctCustomers / 100);
  const avgSale = base.avgSale * (1 + pctAvgSale / 100);
  const repurchaseFrequency = base.repurchaseFrequency * (1 + pctFrequency / 100);
  const total = customers * avgSale * repurchaseFrequency;
  const baseTotal = computeTotal(base);
  const pctIncreaseVsBase = baseTotal > 0 ? ((total - baseTotal) / baseTotal) * 100 : 0;
  return { label, sublabel, customers, avgSale, repurchaseFrequency, total, pctIncreaseVsBase };
}

export function buildPhases(
  base: GrowthBaseline,
  uniformPct: number,
  targetPctCustomers: number,
  targetPctAvgSale: number,
  targetPctFrequency: number
): { current: GrowthPhase; uniform: GrowthPhase; target: GrowthPhase } {
  const roundedUniform = Math.round(uniformPct);
  return {
    current: applyGrowth(base, 0, 0, 0, "Current"),
    uniform: applyGrowth(base, uniformPct, uniformPct, uniformPct, "Compounded Growth", `${roundedUniform}/${roundedUniform}/${roundedUniform}`),
    target: applyGrowth(base, targetPctCustomers, targetPctAvgSale, targetPctFrequency, "Your Target"),
  };
}

export function periodsPerYear(frequency: GrowthFrequency): number {
  return frequency === "weekly" ? 52 : 12;
}

// Guest lifetime value: a guest is worth their per-period spend (avg sale x
// repurchase frequency) annualized, held over the years they stay a guest.
// `ltvToCac` is the classic payback ratio -- healthy is roughly 3:1 or better.
export function guestLifetimeValue(
  base: GrowthBaseline,
  frequency: GrowthFrequency,
  retainedYears: number
): { annualPerGuest: number; ltv: number } {
  const annualPerGuest = base.avgSale * base.repurchaseFrequency * periodsPerYear(frequency);
  return { annualPerGuest, ltv: annualPerGuest * Math.max(0, retainedYears) };
}

export function ltvToCac(ltv: number, cac: number): number | null {
  return cac > 0 ? ltv / cac : null;
}

// Compounds the same per-lever % growth repeatedly over `periods` cycles, to
// show what the trend looks like if that improvement rate is sustained
// period over period rather than applied just once.
export function buildTrajectory(
  base: GrowthBaseline,
  pctCustomers: number,
  pctAvgSale: number,
  pctFrequency: number,
  periods: number
): { period: number; total: number }[] {
  const points: { period: number; total: number }[] = [{ period: 0, total: computeTotal(base) }];
  let current = base;
  for (let i = 1; i <= periods; i++) {
    current = {
      customers: current.customers * (1 + pctCustomers / 100),
      avgSale: current.avgSale * (1 + pctAvgSale / 100),
      repurchaseFrequency: current.repurchaseFrequency * (1 + pctFrequency / 100),
    };
    points.push({ period: i, total: computeTotal(current) });
  }
  return points;
}
