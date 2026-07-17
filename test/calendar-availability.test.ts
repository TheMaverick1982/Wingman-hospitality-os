import { describe, it, expect } from "vitest";
import {
  zonedWallTimeToUtcMs,
  zonedDateParts,
  toRfc3339WithOffset,
  computeSlots,
  intervalIsFree,
  type AvailabilityRule,
} from "@/lib/calendar/availability";
import { buildIcs } from "@/lib/calendar/ics";

describe("zonedWallTimeToUtcMs", () => {
  it("converts an EDT summer wall time to the right UTC instant (offset -4)", () => {
    // 2026-07-20 09:00 America/New_York = 13:00 UTC (EDT, -4).
    const ms = zonedWallTimeToUtcMs("America/New_York", 2026, 7, 20, 9, 0);
    expect(new Date(ms).toISOString()).toBe("2026-07-20T13:00:00.000Z");
  });

  it("converts an EST winter wall time to the right UTC instant (offset -5)", () => {
    // 2026-01-20 09:00 America/New_York = 14:00 UTC (EST, -5).
    const ms = zonedWallTimeToUtcMs("America/New_York", 2026, 1, 20, 9, 0);
    expect(new Date(ms).toISOString()).toBe("2026-01-20T14:00:00.000Z");
  });
});

describe("zonedDateParts", () => {
  it("reports the local weekday/date for an instant", () => {
    // 2026-07-20 13:00 UTC is Monday in New York.
    const p = zonedDateParts("America/New_York", Date.parse("2026-07-20T13:00:00Z"));
    expect(p).toEqual({ year: 2026, month: 7, day: 20, weekday: 1 });
  });
});

describe("toRfc3339WithOffset", () => {
  it("emits the wall time with a numeric offset", () => {
    const iso = toRfc3339WithOffset(Date.parse("2026-07-20T13:00:00Z"), "America/New_York");
    expect(iso).toBe("2026-07-20T09:00:00-04:00");
  });
});

describe("computeSlots", () => {
  const rules: AvailabilityRule[] = [{ weekday: 1, start: "09:00", end: "11:00" }]; // Mondays 9–11

  it("produces 30-min slots inside the window and skips busy times", () => {
    // Anchor "now" to Sunday so the next day (Monday) is fully in-window.
    const now = Date.parse("2026-07-19T12:00:00Z"); // Sun
    // Busy 9:30–10:00 ET Monday.
    const busyStart = zonedWallTimeToUtcMs("America/New_York", 2026, 7, 20, 9, 30);
    const busyEnd = zonedWallTimeToUtcMs("America/New_York", 2026, 7, 20, 10, 0);
    const slots = computeSlots({
      rules,
      timeZone: "America/New_York",
      durationMinutes: 30,
      bufferMinutes: 0,
      advanceNoticeHours: 0,
      windowDays: 3,
      nowMs: now,
      busy: [{ start: busyStart, end: busyEnd }],
    });
    const labels = slots.map((s) => toRfc3339WithOffset(s.startMs, "America/New_York"));
    // 9:00–11:00 → starts at 9:00, 9:30, 10:00, 10:30. The 9:30 slot overlaps busy
    // and is dropped.
    expect(labels).toContain("2026-07-20T09:00:00-04:00");
    expect(labels).not.toContain("2026-07-20T09:30:00-04:00");
    expect(labels).toContain("2026-07-20T10:00:00-04:00");
    expect(labels).toContain("2026-07-20T10:30:00-04:00");
  });

  it("honors the advance-notice lead time", () => {
    const now = Date.parse("2026-07-20T12:30:00Z"); // Monday 08:30 ET
    const slots = computeSlots({
      rules,
      timeZone: "America/New_York",
      durationMinutes: 30,
      bufferMinutes: 0,
      advanceNoticeHours: 2, // earliest bookable = 10:30 ET
      windowDays: 1,
      nowMs: now,
      busy: [],
    });
    const labels = slots.map((s) => toRfc3339WithOffset(s.startMs, "America/New_York"));
    expect(labels).toEqual(["2026-07-20T10:30:00-04:00"]);
  });

  it("applies buffer around busy blocks", () => {
    const now = Date.parse("2026-07-19T12:00:00Z");
    const busyStart = zonedWallTimeToUtcMs("America/New_York", 2026, 7, 20, 10, 0);
    const busyEnd = zonedWallTimeToUtcMs("America/New_York", 2026, 7, 20, 10, 30);
    const slots = computeSlots({
      rules,
      timeZone: "America/New_York",
      durationMinutes: 30,
      bufferMinutes: 15,
      advanceNoticeHours: 0,
      windowDays: 2,
      nowMs: now,
      busy: [{ start: busyStart, end: busyEnd }],
    });
    const labels = slots.map((s) => toRfc3339WithOffset(s.startMs, "America/New_York"));
    // With a 15-min buffer, the 9:30 slot (ends 10:00) collides with the buffered
    // busy block and is dropped; 9:00 remains.
    expect(labels).toContain("2026-07-20T09:00:00-04:00");
    expect(labels).not.toContain("2026-07-20T09:30:00-04:00");
  });
});

describe("intervalIsFree", () => {
  it("detects overlap", () => {
    const busy = [{ start: 100, end: 200 }];
    expect(intervalIsFree(50, 100, busy)).toBe(true); // touches edge, no overlap
    expect(intervalIsFree(150, 250, busy)).toBe(false);
  });
});

describe("buildIcs", () => {
  it("emits a valid VEVENT with UTC stamps", () => {
    const ics = buildIcs({
      uid: "abc@joinwingman.app",
      startMs: Date.parse("2026-07-20T13:00:00Z"),
      endMs: Date.parse("2026-07-20T13:30:00Z"),
      summary: "Wingman demo",
      description: "Join: https://meet.google.com/xyz",
      location: "https://meet.google.com/xyz",
      organizerName: "Rep",
      organizerEmail: "rep@joinwingman.app",
      attendeeName: "Jane",
      attendeeEmail: "jane@example.com",
      createdMs: Date.parse("2026-07-19T00:00:00Z"),
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc@joinwingman.app");
    expect(ics).toContain("DTSTART:20260720T130000Z");
    expect(ics).toContain("DTEND:20260720T133000Z");
    expect(ics).toContain("SUMMARY:Wingman demo");
    expect(ics).toContain("END:VCALENDAR");
  });
});
