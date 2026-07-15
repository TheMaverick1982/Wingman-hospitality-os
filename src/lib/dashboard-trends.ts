import { computeStageCounts, type GuestWithVisits } from "@/lib/hospitality";

// Small, pure helpers for the dashboard's KPI trends. Everything here is derived
// from real data already on the page (or lightweight date lists) — no estimates.

const WEEK_MS = 7 * 86400000;

// Weekly counts of dated events, oldest → newest, `weeks` buckets ending on the
// current (in-progress) week. Bucket index 0 is the oldest, the last is "this week".
export function weeklyBuckets(dates: (string | null | undefined)[], nowMs: number, weeks: number): number[] {
  const buckets = new Array(weeks).fill(0) as number[];
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    const weeksAgo = Math.floor((nowMs - t) / WEEK_MS); // 0 = this week
    if (weeksAgo < 0 || weeksAgo >= weeks) continue;
    buckets[weeks - 1 - weeksAgo] += 1;
  }
  return buckets;
}

// This week's value and the change vs last week, from a weekly series.
export function thisVsLast(buckets: number[]): { thisWeek: number; delta: number } {
  const n = buckets.length;
  const thisWeek = n > 0 ? buckets[n - 1] : 0;
  const lastWeek = n > 1 ? buckets[n - 2] : 0;
  return { thisWeek, delta: thisWeek - lastWeek };
}

// Repeat rate (% of guests back for a 2nd visit) as it stood at a cutoff time:
// visits after the cutoff are ignored, and guests without a first visit by then
// aren't counted yet. Honest week-over-week comparison from in-memory visit data.
export function repeatRateAsOf(guests: GuestWithVisits[], cutoffMs: number): number {
  const asOf = guests
    .map((g) => ({ ...g, guest_visits: g.guest_visits.filter((v) => v.visit_date && new Date(v.visit_date).getTime() <= cutoffMs) }))
    .filter((g) => g.guest_visits.some((v) => v.visit_number === 1));
  return computeStageCounts(asOf).pct[1] || 0;
}

// A short weekly series of the repeat rate, for a sparkline.
export function repeatRateSeries(guests: GuestWithVisits[], nowMs: number, weeks: number): number[] {
  const out: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(repeatRateAsOf(guests, nowMs - i * WEEK_MS));
  return out;
}
