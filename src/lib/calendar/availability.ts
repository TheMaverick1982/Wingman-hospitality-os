// Availability + time-zone math for booking. No tz library in this codebase, so
// conversions use native Intl.DateTimeFormat. Everything here is pure (no I/O) so
// it's easy to unit-test.

export type AvailabilityRule = {
  weekday: number; // 0 = Sunday … 6 = Saturday, in the host's time zone
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
};

// The offset (ms) of an IANA time zone at a given instant: localWallTime - utc.
function tzOffsetMs(timeZone: string, atMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(atMs));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUTC - atMs;
}

// Convert a wall-clock time in `timeZone` to a UTC epoch (ms). Two-pass so the
// offset is evaluated at the target instant, which keeps it correct across DST
// boundaries (a single pass can be off by an hour near a transition).
export function zonedWallTimeToUtcMs(
  timeZone: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
): number {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  let offset = tzOffsetMs(timeZone, naiveUtc);
  let guess = naiveUtc - offset;
  const offset2 = tzOffsetMs(timeZone, guess);
  if (offset2 !== offset) {
    offset = offset2;
    guess = naiveUtc - offset;
  }
  return guess;
}

// The calendar date (Y/M/D) and weekday of an instant, as seen in `timeZone`.
export function zonedDateParts(
  timeZone: string,
  atMs: number,
): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(atMs))) map[p.type] = p.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), weekday: weekdayIndex };
}

function parseHM(hm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export type Slot = { startMs: number; endMs: number };

function overlapsBusy(startMs: number, endMs: number, busy: { start: number; end: number }[]): boolean {
  for (const b of busy) {
    if (startMs < b.end && endMs > b.start) return true;
  }
  return false;
}

// True if [startMs, endMs) doesn't collide with any busy interval (buffer already
// applied by the caller). Exported for round-robin free-member selection.
export function intervalIsFree(startMs: number, endMs: number, busy: { start: number; end: number }[]): boolean {
  return !overlapsBusy(startMs, endMs, busy);
}

// Compute open slots between nowMs and nowMs + windowDays, honoring the weekly
// rules (interpreted in the host tz), meeting duration, buffer, earliest lead
// time, and the host's already-busy intervals. Slots are stepped every
// `stepMinutes` (default = the meeting duration).
export function computeSlots(opts: {
  rules: AvailabilityRule[];
  timeZone: string;
  durationMinutes: number;
  bufferMinutes: number;
  advanceNoticeHours: number;
  windowDays: number;
  nowMs: number;
  busy: { start: number; end: number }[];
  stepMinutes?: number;
}): Slot[] {
  const {
    rules,
    timeZone,
    durationMinutes,
    bufferMinutes,
    advanceNoticeHours,
    windowDays,
    nowMs,
    busy,
  } = opts;
  const step = Math.max(5, opts.stepMinutes ?? durationMinutes);
  const durationMs = durationMinutes * 60_000;
  const bufferMs = bufferMinutes * 60_000;
  const earliest = nowMs + advanceNoticeHours * 3_600_000;
  const windowEnd = nowMs + windowDays * 86_400_000;

  const byWeekday = new Map<number, AvailabilityRule[]>();
  for (const r of rules) {
    const arr = byWeekday.get(r.weekday) ?? [];
    arr.push(r);
    byWeekday.set(r.weekday, arr);
  }

  const slots: Slot[] = [];
  // Walk each calendar day in the host tz. Anchor on noon UTC to avoid landing on
  // a DST-shifted midnight, then read the host-local date for that instant.
  for (let dayOffset = 0; dayOffset <= windowDays; dayOffset++) {
    const probe = nowMs + dayOffset * 86_400_000;
    const { year, month, day, weekday } = zonedDateParts(timeZone, probe);
    const dayRules = byWeekday.get(weekday);
    if (!dayRules?.length) continue;

    for (const rule of dayRules) {
      const s = parseHM(rule.start);
      const e = parseHM(rule.end);
      if (!s || !e) continue;
      const windowStartMs = zonedWallTimeToUtcMs(timeZone, year, month, day, s.h, s.m);
      const windowStopMs = zonedWallTimeToUtcMs(timeZone, year, month, day, e.h, e.m);

      for (let startMs = windowStartMs; startMs + durationMs <= windowStopMs; startMs += step * 60_000) {
        const endMs = startMs + durationMs;
        if (startMs < earliest) continue;
        if (startMs > windowEnd) break;
        // Keep the buffer free on both sides of an existing meeting.
        if (overlapsBusy(startMs - bufferMs, endMs + bufferMs, busy)) continue;
        slots.push({ startMs, endMs });
      }
    }
  }

  slots.sort((a, b) => a.startMs - b.startMs);
  // De-dupe (overlapping rules can produce the same start).
  const seen = new Set<number>();
  return slots.filter((slot) => {
    if (seen.has(slot.startMs)) return false;
    seen.add(slot.startMs);
    return true;
  });
}

// RFC3339 timestamp WITH the host tz's numeric offset (e.g.
// 2026-07-20T09:00:00-04:00) — what Google's event start/end dateTime expects.
export function toRfc3339WithOffset(atMs: number, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(atMs));
  const map: Record<string, string> = {};
  for (const part of p) map[part.type] = part.value;
  const offsetMin = tzOffsetMs(timeZone, atMs) / 60_000;
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(Math.round(abs % 60)).padStart(2, "0");
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${sign}${oh}:${om}`;
}

// Human label for a slot in a given tz, e.g. "9:00 AM".
export function formatTime(atMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(atMs));
}

// e.g. "Monday, July 20, 2026"
export function formatDateLong(atMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(atMs));
}
