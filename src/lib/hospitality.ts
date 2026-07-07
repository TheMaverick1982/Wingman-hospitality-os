export type VisitReaction = "wowed" | "delighted" | "neutral" | "let_down";

export type GuestVisit = {
  visit_number: number;
  visit_date: string | null;
  location_id: string | null;
  incentive: string | null;
  notes: string | null;
  reaction?: VisitReaction | null;
};

export type GuestWithVisits = {
  id: string;
  name: string;
  phone: string;
  email: string;
  guest_visits: GuestVisit[];
  referred_a_friend?: boolean;
};

export function stageOf(visits: GuestVisit[]): number {
  let stage = 0;
  for (let n = 1; n <= 4; n++) {
    if (visits.some((v) => v.visit_number === n && v.visit_date)) stage = n;
  }
  return stage;
}

export function visitAt(visits: GuestVisit[], n: number): GuestVisit | undefined {
  return visits.find((v) => v.visit_number === n);
}

export function computeStageCounts(guests: GuestWithVisits[]) {
  const total = guests.length || 1;
  const counts = [1, 2, 3, 4].map((n) => guests.filter((g) => stageOf(g.guest_visits) >= n).length);
  return {
    total: guests.length,
    counts,
    pct: counts.map((c) => Math.round((c / total) * 100)),
  };
}

export type Discount = {
  id: string;
  occurred_on: string;
  location_id: string;
  server_name: string;
  category: string;
  reason: string;
  amount: number;
  notes: string;
};

export function aggregateBy<T>(items: T[], key: (item: T) => string, amount: (item: T) => number) {
  const map = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const k = key(item);
    const entry = map.get(k) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += amount(item);
    map.set(k, entry);
  }
  return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
}

export type SpotCheck = {
  id: string;
  staff_name: string;
  scores: number[];
};

export function computeSpotCheckAverages(spotChecks: SpotCheck[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const sc of spotChecks) {
    const avg = sc.scores.reduce((a, b) => a + b, 0) / sc.scores.length;
    const entry = map.get(sc.staff_name) ?? { total: 0, count: 0 };
    entry.total += avg;
    entry.count += 1;
    map.set(sc.staff_name, entry);
  }
  return [...map.entries()].map(([name, v]) => ({ name, avg: v.total / v.count }));
}
