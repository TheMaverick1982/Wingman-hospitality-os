// Pure trend helpers for Reporting. Kept free of I/O and clock reads (callers
// pass `now`) so they're unit-testable.

export type VisitLite = { visit_number: number; visit_date: string | null };
export type GuestLite = { guest_visits: VisitLite[] };

export type CohortMonth = {
  key: string; // YYYY-MM
  label: string; // e.g. "Feb"
  newGuests: number; // first-timers whose visit 1 fell in this month
  returned: number; // of those, how many ever reached visit 2+
  repeatPct: number; // returned / newGuests * 100 (0 when no new guests)
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

// Repeat-rate by cohort month: for each of the last `monthsBack` months, the
// share of that month's first-timers who ever came back for a 2nd visit.
// Oldest month first. `now` anchors the window.
export function monthlyRepeatCohorts(guests: GuestLite[], now: Date, monthsBack = 6): CohortMonth[] {
  // Seed the buckets for each month in the window so empty months still show.
  const buckets = new Map<string, CohortMonth>();
  const order: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d.getFullYear(), d.getMonth());
    buckets.set(key, { key, label: MONTH_LABELS[d.getMonth()], newGuests: 0, returned: 0, repeatPct: 0 });
    order.push(key);
  }

  for (const g of guests) {
    const first = g.guest_visits.find((v) => v.visit_number === 1 && v.visit_date);
    if (!first?.visit_date) continue;
    const key = first.visit_date.slice(0, 7); // YYYY-MM
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the window
    bucket.newGuests += 1;
    const returned = g.guest_visits.some((v) => v.visit_number >= 2 && v.visit_date);
    if (returned) bucket.returned += 1;
  }

  for (const key of order) {
    const b = buckets.get(key)!;
    b.repeatPct = b.newGuests > 0 ? Math.round((b.returned / b.newGuests) * 100) : 0;
  }
  return order.map((k) => buckets.get(k)!);
}

// --- Business-health (POS) weekly trend --------------------------------------

export type BizHealthRow = {
  period_date: string;
  net_sales: number | null;
  labor_cost: number | null;
  comp_cost: number | null;
  checks: number | null;
};

export type BizHealthPoint = {
  label: string; // short date
  netSales: number;
  laborPct: number; // labor_cost / net_sales * 100
  avgCheck: number; // net_sales / checks
  compPct: number; // comp_cost / net_sales * 100
};

export function bizHealthTrend(rows: BizHealthRow[]): BizHealthPoint[] {
  // Rows may arrive newest-first; render oldest → newest.
  const sorted = [...rows].sort((a, b) => a.period_date.localeCompare(b.period_date));
  return sorted.map((r) => {
    const sales = Number(r.net_sales ?? 0);
    const labor = Number(r.labor_cost ?? 0);
    const comp = Number(r.comp_cost ?? 0);
    const checks = Number(r.checks ?? 0);
    const [, m, d] = r.period_date.slice(0, 10).split("-");
    return {
      label: `${Number(m)}/${Number(d)}`,
      netSales: sales,
      laborPct: sales > 0 ? Math.round((labor / sales) * 100) : 0,
      avgCheck: checks > 0 ? sales / checks : 0,
      compPct: sales > 0 ? Math.round((comp / sales) * 1000) / 10 : 0,
    };
  });
}
