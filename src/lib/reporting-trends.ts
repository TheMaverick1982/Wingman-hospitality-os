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

// --- Training completion by month --------------------------------------------

export type SignoffLite = { completion_pct: number; occurred_on: string | null };
export type TrainingMonth = { key: string; label: string; avgCompletion: number; count: number };

// Average sign-off completion per month over the last `monthsBack` months — a
// proxy for how close the team was held to standard. Pairs with the repeat-rate
// cohorts so an operator can see the two move together.
export function monthlyTrainingCompletion(signoffs: SignoffLite[], now: Date, monthsBack = 6): TrainingMonth[] {
  const buckets = new Map<string, { sum: number; count: number; label: string }>();
  const order: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d.getFullYear(), d.getMonth());
    buckets.set(key, { sum: 0, count: 0, label: MONTH_LABELS[d.getMonth()] });
    order.push(key);
  }
  for (const s of signoffs) {
    if (!s.occurred_on) continue;
    const key = s.occurred_on.slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    b.sum += Number(s.completion_pct) || 0;
    b.count += 1;
  }
  return order.map((k) => {
    const b = buckets.get(k)!;
    return { key: k, label: b.label, count: b.count, avgCompletion: b.count > 0 ? Math.round(b.sum / b.count) : 0 };
  });
}

// --- Checklist compliance by month -------------------------------------------

export type ChecklistLite = { occurred_on: string | null; item_count: number; completed_count: number };
export type ComplianceMonth = { key: string; label: string; pct: number; logs: number };

// Share of checklist items actually completed, per month — a read on whether the
// team is running their shift checklists or just clocking in.
export function monthlyChecklistCompliance(rows: ChecklistLite[], now: Date, monthsBack = 6): ComplianceMonth[] {
  const buckets = new Map<string, { done: number; total: number; logs: number; label: string }>();
  const order: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d.getFullYear(), d.getMonth());
    buckets.set(key, { done: 0, total: 0, logs: 0, label: MONTH_LABELS[d.getMonth()] });
    order.push(key);
  }
  for (const r of rows) {
    if (!r.occurred_on) continue;
    const b = buckets.get(r.occurred_on.slice(0, 7));
    if (!b) continue;
    b.done += Number(r.completed_count) || 0;
    b.total += Number(r.item_count) || 0;
    b.logs += 1;
  }
  return order.map((k) => {
    const b = buckets.get(k)!;
    return { key: k, label: b.label, logs: b.logs, pct: b.total > 0 ? Math.round((b.done / b.total) * 100) : 0 };
  });
}

// --- Incentive effectiveness -------------------------------------------------

export type IncentiveGuest = { guest_visits: { visit_number: number; visit_date: string | null; incentive?: string | null }[] };
export type IncentiveStat = { incentive: string; newGuests: number; returned: number; returnPct: number };

// Which visit-1 offer best turns a first-timer into a second visit. Groups
// first-timers by the incentive they were given, and measures how many came back.
export function incentiveEffectiveness(guests: IncentiveGuest[]): IncentiveStat[] {
  const map = new Map<string, { newGuests: number; returned: number }>();
  for (const g of guests) {
    const first = g.guest_visits.find((v) => v.visit_number === 1);
    const incentive = (first?.incentive || "").trim();
    if (!incentive) continue; // only measure guests who actually got an offer
    const entry = map.get(incentive) ?? { newGuests: 0, returned: 0 };
    entry.newGuests += 1;
    if (g.guest_visits.some((v) => v.visit_number >= 2 && v.visit_date)) entry.returned += 1;
    map.set(incentive, entry);
  }
  return [...map.entries()]
    .map(([incentive, v]) => ({ incentive, newGuests: v.newGuests, returned: v.returned, returnPct: v.newGuests > 0 ? Math.round((v.returned / v.newGuests) * 100) : 0 }))
    .sort((a, b) => b.returnPct - a.returnPct || b.newGuests - a.newGuests);
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

export type BizHealthRawRow = BizHealthRow & { location_id: string | null };

// Collapse per-location weekly rows into one company total per week. Reporting is
// a company-wide report, but business_health_metrics stores one row per location
// per week (plus optional org-wide rows). Without this, a multi-location org's
// money-layer trend interleaves/duplicates a point per location for each week.
//
// For each week: if any location-scoped rows exist, sum those (the real per-store
// totals); otherwise fall back to the org-wide (null-location) row. That avoids
// double-counting when both a per-location and an org-wide row exist for a week.
export function aggregateBizHealthByWeek(rows: BizHealthRawRow[]): BizHealthRow[] {
  const byWeek = new Map<string, { located: BizHealthRow[]; orgWide: BizHealthRow[] }>();
  for (const r of rows) {
    const e = byWeek.get(r.period_date) ?? { located: [], orgWide: [] };
    (r.location_id ? e.located : e.orgWide).push(r);
    byWeek.set(r.period_date, e);
  }
  const sum = (rs: BizHealthRow[]): BizHealthRow => ({
    period_date: rs[0].period_date,
    net_sales: rs.reduce((s, x) => s + Number(x.net_sales ?? 0), 0),
    labor_cost: rs.reduce((s, x) => s + Number(x.labor_cost ?? 0), 0),
    comp_cost: rs.reduce((s, x) => s + Number(x.comp_cost ?? 0), 0),
    checks: rs.reduce((s, x) => s + Number(x.checks ?? 0), 0),
  });
  return [...byWeek.values()].map((e) => sum(e.located.length ? e.located : e.orgWide));
}

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
