"use client";

import { useState } from "react";
import { CalendarX, Check, Loader2, Video } from "lucide-react";

export function ManageClient({
  token,
  hostName,
  dateLabel,
  timeLabel,
  timeZone,
  meetLink,
  status,
  rebookPath,
}: {
  token: string;
  hostName: string;
  dateLabel: string;
  timeLabel: string;
  timeZone: string;
  meetLink: string;
  status: string;
  rebookPath: string;
}) {
  const [cancelled, setCancelled] = useState(status === "cancelled");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(token)}/cancel`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't cancel. Please try again.");
        setBusy(false);
        return;
      }
      setCancelled(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (cancelled) {
    return (
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-full bg-danger-tint text-danger flex items-center justify-center mx-auto mb-4">
          <CalendarX size={26} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">Booking cancelled</h1>
        <p className="text-muted mb-6">Your meeting with {hostName} has been cancelled.</p>
        <a
          href={rebookPath}
          className="inline-flex items-center gap-2 rounded-full bg-brick text-white font-semibold px-5 py-2.5 text-sm hover:bg-brick-dark transition-colors"
        >
          Pick a new time
        </a>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] font-semibold text-brick uppercase tracking-[0.06em] mb-2">Your booking</p>
      <h1 className="font-display text-2xl font-semibold text-ink leading-tight mb-1">Meeting with {hostName}</h1>

      <div className="bg-paper border border-line rounded-xl px-4 py-3 my-5">
        <div className="text-sm font-semibold text-ink">{dateLabel}</div>
        <div className="text-sm text-muted">
          {timeLabel} · {timeZone}
        </div>
      </div>

      {meetLink && (
        <a
          href={meetLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-brick font-medium text-sm mb-6"
        >
          <Video size={16} /> Join with Google Meet
        </a>
      )}

      <div className="border-t border-line pt-5">
        {!confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={rebookPath}
              className="inline-flex items-center gap-2 rounded-full bg-panel border border-line-strong text-ink font-semibold px-5 py-2.5 text-sm hover:bg-paper transition-colors"
            >
              Reschedule
            </a>
            <button
              onClick={() => setConfirming(true)}
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-panel border border-danger-tint text-danger font-semibold px-5 py-2.5 text-sm hover:bg-danger-tint transition-colors"
            >
              <CalendarX size={16} /> Cancel meeting
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-ink mb-3">Cancel this meeting? To reschedule instead, use the button above.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={cancel}
                disabled={busy}
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-danger text-white font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Yes, cancel
              </button>
              <button onClick={() => setConfirming(false)} type="button" className="text-sm text-muted hover:text-ink">
                Keep it
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-danger text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}
