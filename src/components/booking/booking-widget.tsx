"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Globe, Loader2, Video } from "lucide-react";
import { BOOKING_TIMEZONES } from "@/lib/calendar/timezones";

type SlotDTO = { start: number; end: number; day: string; date: string; time: string };

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Label the video link by its host for the confirmation screen.
function videoLabel(url: string): string {
  if (/zoom\.us/i.test(url)) return "Join with Zoom";
  if (/meet\.google/i.test(url)) return "Join with Google Meet";
  return "Join the video call";
}

// Self-contained booking flow used by both the per-salesperson /book/[slug] page
// and the public round-robin /book-a-demo marketing page. Shows a month calendar
// to pick a day, then the open times that day, then collects details.
export function BookingWidget({
  slotsUrl,
  bookUrl,
  durationMinutes,
}: {
  slotsUrl: string;
  bookUrl: string;
  hostName?: string;
  durationMinutes: number;
}) {
  const [tz, setTz] = useState<string>(() => guessTimeZone());
  const [slots, setSlots] = useState<SlotDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [chosen, setChosen] = useState<SlotDTO | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ meetLink: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await fetch(`${slotsUrl}?tz=${encodeURIComponent(tz)}`);
        if (!r.ok) throw new Error(r.status === 404 ? "This booking page isn't available." : "Couldn't load times.");
        const data = (await r.json()) as { slots: SlotDTO[] };
        if (cancelled) return;
        const list = data.slots ?? [];
        setSlots(list);
        setSelectedDay(null); // show the calendar first; user picks a day
        const first = list[0];
        if (first) {
          const [y, m] = first.day.split("-").map(Number);
          setView({ year: y, month: m - 1 });
        } else {
          setView(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slotsUrl, tz]);

  const availableDays = useMemo(() => new Set(slots.map((s) => s.day)), [slots]);
  const daySlots = useMemo(() => slots.filter((s) => s.day === selectedDay), [slots, selectedDay]);

  // Calendar grid cells for the current view month (pure date arithmetic in UTC so
  // it doesn't drift with the browser zone).
  const cells = useMemo(() => {
    if (!view) return [] as (string | null)[];
    const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(`${view.year}-${pad(view.month + 1)}-${pad(d)}`);
    return out;
  }, [view]);

  const firstAvailableDay = slots[0]?.day ?? null;
  const canGoPrev = useMemo(() => {
    if (!view || !firstAvailableDay) return false;
    const [fy, fm] = firstAvailableDay.split("-").map(Number);
    return view.year > fy || (view.year === fy && view.month > fm - 1);
  }, [view, firstAvailableDay]);
  const lastAvailableDay = slots.length ? slots[slots.length - 1].day : null;
  const canGoNext = useMemo(() => {
    if (!view || !lastAvailableDay) return false;
    const [ly, lm] = lastAvailableDay.split("-").map(Number);
    return view.year < ly || (view.year === ly && view.month < lm - 1);
  }, [view, lastAvailableDay]);

  function shiftMonth(delta: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  async function submit() {
    if (!chosen) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(bookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: chosen.start, name, email, phone, notes, tz }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; meetLink?: string; code?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't book that time.");
        if (data.code === "slot_taken") {
          setChosen(null);
          const r = await fetch(`${slotsUrl}?tz=${encodeURIComponent(tz)}`);
          const d = (await r.json()) as { slots?: SlotDTO[] };
          setSlots(d.slots ?? []);
        }
        setSubmitting(false);
        return;
      }
      setDone({ meetLink: data.meetLink ?? "" });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-olive-tint text-[#15803D] flex items-center justify-center mx-auto mb-4">
          <Check size={28} />
        </div>
        <h3 className="font-display text-2xl font-semibold text-ink mb-2">You&apos;re booked!</h3>
        <p className="text-muted mb-1">
          A confirmation with a calendar invite is on its way to <span className="font-medium text-ink">{email}</span>.
        </p>
        {chosen && (
          <p className="text-sm text-muted mb-5">
            {chosen.date} at {chosen.time} ({tz})
          </p>
        )}
        {done.meetLink && (
          <a
            href={done.meetLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brick text-white font-semibold px-5 py-2.5 text-sm hover:bg-brick-dark transition-colors"
          >
            <Video size={16} /> {videoLabel(done.meetLink)}
          </a>
        )}
      </div>
    );
  }

  // Details form
  if (chosen) {
    return (
      <div>
        <button onClick={() => setChosen(null)} type="button" className="text-sm text-muted hover:text-ink inline-flex items-center gap-1 mb-4">
          <ChevronLeft size={15} /> Back to times
        </button>
        <div className="bg-paper border border-line rounded-xl px-4 py-3 mb-5">
          <div className="text-sm font-semibold text-ink">{chosen.date}</div>
          <div className="text-sm text-muted">
            {chosen.time} · {durationMinutes} min · {tz}
          </div>
        </div>
        <label className="block text-[13px] font-semibold mb-1.5 text-ink">Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Jane Doe" />
        <label className="block text-[13px] font-semibold mb-1.5 mt-4 text-ink">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={INPUT} placeholder="jane@restaurant.com" />
        <label className="block text-[13px] font-semibold mb-1.5 mt-4 text-ink">
          Mobile <span className="font-normal text-muted">(for text reminders)</span>
        </label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={INPUT} placeholder="(555) 123-4567" />
        <label className="block text-[13px] font-semibold mb-1.5 mt-4 text-ink">Anything we should know? (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${INPUT} min-h-[80px]`} placeholder="What you'd like to cover." />
        {error && <p className="text-danger text-sm mt-3">{error}</p>}
        <button
          onClick={submit}
          disabled={submitting || !name.trim() || !email.trim() || !phone.trim()}
          type="button"
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brick text-white font-semibold px-5 py-3 text-sm hover:bg-brick-dark transition-colors disabled:opacity-40"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />} Confirm booking
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted mb-5">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} /> {durationMinutes} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Video size={15} /> Video call
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 text-muted">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-danger text-sm py-6">{loadError}</p>
      ) : slots.length === 0 ? (
        <p className="text-muted text-sm py-6">No open times right now — please check back soon.</p>
      ) : selectedDay === null ? (
        // Step 1: pick a date on the month calendar.
        <div className="max-w-[360px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-semibold text-ink">{view ? `${MONTH_NAMES[view.month]} ${view.year}` : ""}</div>
            <div className="flex items-center gap-1">
              <button onClick={() => shiftMonth(-1)} disabled={!canGoPrev} type="button" className="p-1.5 rounded-lg text-muted hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => shiftMonth(1)} disabled={!canGoNext} type="button" className="p-1.5 rounded-lg text-muted hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="text-center text-[11px] font-semibold text-muted py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const dayNum = Number(day.slice(8));
              const isAvailable = availableDays.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-full text-[15px] flex items-center justify-center transition-colors ${
                    isAvailable
                      ? "text-brick font-semibold bg-brick-tint hover:bg-brick hover:text-white"
                      : "text-muted-2 cursor-default"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        // Step 2: pick a time for the selected day (calendar hidden).
        <div className="max-w-[440px] mx-auto">
          <button onClick={() => setSelectedDay(null)} type="button" className="text-sm text-muted hover:text-ink inline-flex items-center gap-1 mb-4">
            <ChevronLeft size={15} /> Choose another date
          </button>
          <div className="text-[15px] font-semibold text-ink mb-3">{daySlots[0]?.date ?? selectedDay}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto content-start pr-1">
            {daySlots.map((s) => (
              <button
                key={s.start}
                onClick={() => {
                  setChosen(s);
                  setError(null);
                }}
                type="button"
                className="text-sm rounded-xl px-3 py-2.5 border border-line-strong text-ink font-medium hover:border-brick hover:bg-brick-tint transition-colors"
              >
                {s.time}
              </button>
            ))}
            {daySlots.length === 0 && <p className="text-sm text-muted col-span-full">No times this day.</p>}
          </div>
        </div>
      )}

      {/* Time zone */}
      <div className="mt-6 pt-4 border-t border-line flex items-center gap-2 justify-center">
        <Globe size={15} className="text-muted shrink-0" />
        <span className="text-sm text-muted whitespace-nowrap">Times in</span>
        <select value={tz} onChange={(e) => setTz(e.target.value)} className="text-sm bg-transparent text-ink font-medium outline-none border border-line rounded-lg px-2 py-1 max-w-[240px]">
          {BOOKING_TIMEZONES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-[10px] px-[14px] py-[11px] text-[15px] border border-line-strong bg-panel text-ink outline-none transition-shadow duration-150 focus:border-brick focus:ring-[3px] focus:ring-brick-tint";
