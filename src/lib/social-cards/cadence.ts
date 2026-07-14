// Posting cadence: Tue / Thu / Sat / Sun at 9:30am Eastern. Computes the next N
// slots strictly after a given point (the furthest-out scheduled post), with the
// correct EDT/EST offset, so generated batches never overlap the existing queue.

const CADENCE_DOW = new Set([2, 4, 6, 0]); // Tue, Thu, Sat, Sun (getUTCDay)
const HOUR = 9;
const MIN = 30;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// US Eastern DST: from the 2nd Sunday of March to the 1st Sunday of November.
// (Approximate at the day level — fine for a 9:30am slot far from the 2am switch.)
function nthSunday(year: number, month0: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const firstSunday = ((7 - firstDow) % 7) + 1;
  return firstSunday + (n - 1) * 7;
}
function isEasternDST(year: number, month0: number, day: number): boolean {
  if (month0 < 2 || month0 > 10) return false; // Jan, Feb, Dec = EST
  if (month0 > 2 && month0 < 10) return true; // Apr–Oct = EDT
  if (month0 === 2) return day >= nthSunday(year, 2, 2); // March: on/after 2nd Sun
  return day < nthSunday(year, 10, 1); // November: before 1st Sun
}

// The instant (ms) of 9:30am Eastern on a given calendar date.
function slotMs(year: number, month0: number, day: number): number {
  const offsetHours = isEasternDST(year, month0, day) ? 4 : 5; // ET = UTC - offset
  return Date.UTC(year, month0, day, HOUR + offsetHours, MIN, 0);
}
function slotIso(year: number, month0: number, day: number): string {
  const off = isEasternDST(year, month0, day) ? "-04:00" : "-05:00";
  return `${year}-${pad(month0 + 1)}-${pad(day)}T${pad(HOUR)}:${pad(MIN)}:00${off}`;
}

// Next N cadence slots strictly after max(now, afterIso). Pass the furthest-out
// scheduled_at so a fresh batch queues up after the existing runway.
export function nextCadenceSlots(afterIso: string | null | undefined, n: number, nowMs = Date.now()): string[] {
  const afterMs = Math.max(nowMs, afterIso ? Date.parse(afterIso) || 0 : 0);
  const out: string[] = [];
  const start = new Date(afterMs);
  const y0 = start.getUTCFullYear();
  const m0 = start.getUTCMonth();
  const d0 = start.getUTCDate();
  for (let i = 0; i < 240 && out.length < n; i++) {
    const dt = new Date(Date.UTC(y0, m0, d0 + i));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const d = dt.getUTCDate();
    if (!CADENCE_DOW.has(dt.getUTCDay())) continue;
    if (slotMs(y, m, d) <= afterMs) continue; // strictly after
    out.push(slotIso(y, m, d));
  }
  return out;
}
