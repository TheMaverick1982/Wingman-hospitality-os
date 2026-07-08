export type GrowthFrequency = "weekly" | "monthly";

export type GrowthBaseline = {
  customers: number;
  avgSale: number;
  repurchaseFrequency: number;
};

export type GrowthPhase = {
  label: string;
  customers: number;
  avgSale: number;
  repurchaseFrequency: number;
  total: number;
  pctIncreaseVsBase: number;
};

function computeTotal(b: GrowthBaseline): number {
  return b.customers * b.avgSale * b.repurchaseFrequency;
}

function applyGrowth(base: GrowthBaseline, pctCustomers: number, pctAvgSale: number, pctFrequency: number, label: string): GrowthPhase {
  const customers = base.customers * (1 + pctCustomers / 100);
  const avgSale = base.avgSale * (1 + pctAvgSale / 100);
  const repurchaseFrequency = base.repurchaseFrequency * (1 + pctFrequency / 100);
  const total = customers * avgSale * repurchaseFrequency;
  const baseTotal = computeTotal(base);
  const pctIncreaseVsBase = baseTotal > 0 ? ((total - baseTotal) / baseTotal) * 100 : 0;
  return { label, customers, avgSale, repurchaseFrequency, total, pctIncreaseVsBase };
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
    uniform: applyGrowth(base, uniformPct, uniformPct, uniformPct, `${roundedUniform}/${roundedUniform}/${roundedUniform} Plan`),
    target: applyGrowth(base, targetPctCustomers, targetPctAvgSale, targetPctFrequency, "Your Target"),
  };
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
