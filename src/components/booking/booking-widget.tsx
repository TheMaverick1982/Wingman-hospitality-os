"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, ChevronLeft, Clock, Loader2, Video } from "lucide-react";

type SlotDTO = { start: number; end: number; date: string; time: string };

function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

// Self-contained booking flow used by both the per-salesperson /book/[slug] page
// and the public round-robin /book-a-demo marketing page. Fetches open slots, lets
// the guest pick a day + time, collects their details, and books. The endpoints
// are injected so the same widget drives a single rep or the demo pool.
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
  // Detect the visitor's zone at first render (SSR falls back to the same default).
  const [tz] = useState<string>(() => guessTimeZone());
  const [slots, setSlots] = useState<SlotDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [chosen, setChosen] = useState<SlotDTO | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
        setSlots(data.slots ?? []);
        setActiveDate(data.slots?.[0]?.date ?? null);
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

  const dates = useMemo(() => {
    const seen: string[] = [];
    for (const s of slots) if (!seen.includes(s.date)) seen.push(s.date);
    return seen;
  }, [slots]);

  const daySlots = useMemo(() => slots.filter((s) => s.date === activeDate), [slots, activeDate]);

  async function submit() {
    if (!chosen) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(bookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: chosen.start, name, email, notes, tz }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; meetLink?: string; code?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't book that time.");
        // If the slot was taken, refresh the list.
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
            <Video size={16} /> Join with Google Meet
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-sm text-muted mb-5">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} /> {durationMinutes} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Video size={15} /> Google Meet
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
      ) : chosen ? (
        // Details form
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
          <label className="block text-[13px] font-semibold mb-1.5 mt-4 text-ink">Anything we should know? (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${INPUT} min-h-[80px]`} placeholder="What you'd like to cover." />
          {error && <p className="text-danger text-sm mt-3">{error}</p>}
          <button
            onClick={submit}
            disabled={submitting || !name.trim() || !email.trim()}
            type="button"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brick text-white font-semibold px-5 py-3 text-sm hover:bg-brick-dark transition-colors disabled:opacity-40"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />} Confirm booking
          </button>
        </div>
      ) : (
        // Date + time picker
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5">
          <div className="flex sm:flex-col gap-2 overflow-x-auto sm:max-h-[320px] sm:overflow-y-auto pb-1">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDate(d)}
                type="button"
                className={`text-left text-sm rounded-xl px-3.5 py-2.5 border whitespace-nowrap transition-colors ${
                  d === activeDate ? "border-brick bg-brick-tint text-brick-dark font-semibold" : "border-line text-charcoal-2 hover:bg-paper"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:max-h-[320px] sm:overflow-y-auto content-start">
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
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-[10px] px-[14px] py-[11px] text-[15px] border border-line-strong bg-panel text-ink outline-none transition-shadow duration-150 focus:border-brick focus:ring-[3px] focus:ring-brick-tint";
