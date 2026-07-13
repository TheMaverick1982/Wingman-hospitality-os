// Actual revenue from logged bill totals, broken out by visit stage. Powers the
// "Revenue by visit" view and lets the ROI ledger use a real average check
// instead of an estimate. Pure + client-safe.

import { type GuestWithVisits } from "./hospitality";

export type VisitRevenue = { visit: number; total: number; count: number; avg: number };

export type GuestRevenue = {
  byVisit: VisitRevenue[]; // visits 1..4
  total: number; // all logged bill totals
  firstVisitRevenue: number; // visit 1 — the money you'd get anyway
  repeatRevenue: number; // visits 2–4 — revenue the bounce-back program brought back
  billedVisits: number; // how many visits carry a bill total
  avgCheck: number; // average bill across billed visits (0 when none)
};

// `sinceIso` (YYYY-MM-DD) optionally limits to visits on/after that date, so a
// report window only counts revenue earned inside it.
export function computeGuestRevenue(guests: GuestWithVisits[], sinceIso?: string): GuestRevenue {
  const byVisit: VisitRevenue[] = [1, 2, 3, 4].map((visit) => ({ visit, total: 0, count: 0, avg: 0 }));

  for (const g of guests) {
    for (const v of g.guest_visits) {
      const bill = v.bill_total;
      if (bill == null || !Number.isFinite(Number(bill)) || Number(bill) <= 0) continue;
      if (sinceIso && (!v.visit_date || v.visit_date < sinceIso)) continue;
      if (v.visit_number < 1 || v.visit_number > 4) continue;
      const slot = byVisit[v.visit_number - 1];
      slot.total += Number(bill);
      slot.count += 1;
    }
  }

  for (const s of byVisit) s.avg = s.count > 0 ? s.total / s.count : 0;

  const total = byVisit.reduce((n, s) => n + s.total, 0);
  const billedVisits = byVisit.reduce((n, s) => n + s.count, 0);
  const firstVisitRevenue = byVisit[0].total;
  const repeatRevenue = byVisit.slice(1).reduce((n, s) => n + s.total, 0);
  const avgCheck = billedVisits > 0 ? total / billedVisits : 0;

  return { byVisit, total, firstVisitRevenue, repeatRevenue, billedVisits, avgCheck };
}
