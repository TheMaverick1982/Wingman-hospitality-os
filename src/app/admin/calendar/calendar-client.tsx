"use client";

import { useState, useTransition } from "react";
import { Calendar, Check, Copy, Link2, PlugZap, Trash2, Video } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { BOOKING_TIMEZONES } from "@/lib/calendar/timezones";
import type { AvailabilityRule } from "@/lib/calendar/availability";
import type { CalendarSettings, DemoPoolConfig, PublicAccountInfo, BookingRow } from "@/lib/calendar/settings";
import { saveCalendarSettings, disconnectCalendarAccount, disconnectZoom, markBookingOutcome } from "./actions";
import { AvailabilityEditor } from "./availability-editor";
import { DemoPoolCard } from "./demo-pool-card";
import type { VideoProvider } from "@/lib/calendar/settings";

const DURATIONS = [15, 20, 30, 45, 60];

function flagBanner(flag: string, msg: string): { tone: "ok" | "err"; text: string } | null {
  switch (flag) {
    case "connected":
      return { tone: "ok", text: "Calendar connected." };
    case "denied":
      return { tone: "err", text: "Connection cancelled." };
    case "badstate":
      return { tone: "err", text: "Connection expired — please try again." };
    case "unconfigured":
      return { tone: "err", text: "That calendar provider isn't configured on this environment yet." };
    case "error":
      return { tone: "err", text: msg || "Something went wrong connecting your calendar." };
    default:
      return null;
  }
}

export type CalendarClientProps = {
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  baseUrl: string;
  accounts: PublicAccountInfo[];
  settings: CalendarSettings;
  bookings: BookingRow[];
  flag: string;
  flagMsg: string;
  isSuper: boolean;
  demoConfig: DemoPoolConfig;
  demoMemberCount: number;
  zoomConfigured: boolean;
  zoomEmail: string | null;
};

export function CalendarClient({
  googleConfigured,
  microsoftConfigured,
  baseUrl,
  accounts,
  settings,
  bookings,
  flag,
  flagMsg,
  isSuper,
  demoConfig,
  demoMemberCount,
  zoomConfigured,
  zoomEmail,
}: CalendarClientProps) {
  const [slug, setSlug] = useState(settings.slug);
  const [timeZone, setTimeZone] = useState(settings.time_zone);
  const [duration, setDuration] = useState(settings.meeting_duration_minutes);
  const [buffer, setBuffer] = useState(settings.buffer_minutes);
  const [notice, setNotice] = useState(settings.advance_notice_hours);
  const [windowDays, setWindowDays] = useState(settings.booking_window_days);
  const [pageTitle, setPageTitle] = useState(settings.page_title);
  const [pageDescription, setPageDescription] = useState(settings.page_description);
  const [isActive, setIsActive] = useState(settings.is_active);
  const [videoProvider, setVideoProvider] = useState<VideoProvider>(settings.video_provider);
  const [rules, setRules] = useState<AvailabilityRule[]>(settings.availability);

  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const banner = flagBanner(flag, flagMsg);
  const connected = accounts.length > 0;
  const googleCount = accounts.filter((a) => a.provider === "google").length;
  const microsoftCount = accounts.filter((a) => a.provider === "microsoft").length;
  const bookingUrl = `${baseUrl}/book/${slug}`;

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveCalendarSettings({
        slug,
        timeZone,
        meetingDurationMinutes: duration,
        bufferMinutes: buffer,
        advanceNoticeHours: notice,
        bookingWindowDays: windowDays,
        availability: rules,
        pageTitle,
        pageDescription,
        isActive,
        videoProvider,
      });
      if (res.error) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      if (res.slug && res.slug !== slug) setSlug(res.slug);
      setMsg({ tone: "ok", text: "Saved." });
    });
  }

  function disconnect(provider: "google" | "microsoft", id: string) {
    startTransition(async () => {
      const res = await disconnectCalendarAccount(provider, id);
      if (res.error) setMsg({ tone: "err", text: res.error });
    });
  }

  function removeZoom() {
    startTransition(async () => {
      const res = await disconnectZoom();
      if (res.error) setMsg({ tone: "err", text: res.error });
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Calendar</h1>
        <p className="text-muted mt-1">
          Connect Google Calendar, set your availability, and share your booking page. Meetings are
          created with a Google Meet link and a confirmation email.
        </p>
      </div>

      {banner && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            banner.tone === "ok" ? "bg-olive-tint text-[#15803D]" : "bg-danger-tint text-danger"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Connected calendars */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl font-semibold text-ink">Connected calendars</h2>
          {connected && <Pill tone="olive" dot>{accounts.length} connected</Pill>}
        </div>
        <p className="text-sm text-muted mb-4">
          Connect Google and/or Outlook (up to two of each). We merge free/busy across all of them so
          you&apos;re never double-booked. Google meetings get a Meet link; Outlook meetings use Zoom
          (coming next).
        </p>

        {accounts.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {accounts.map((a) => (
              <div key={`${a.provider}-${a.id}`} className="flex items-center justify-between border border-line rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-olive-tint text-[#15803D] flex items-center justify-center">
                    <Check size={15} />
                  </span>
                  <span className="text-sm font-medium text-ink">{a.email || (a.provider === "microsoft" ? "Outlook account" : "Google account")}</span>
                  <Pill tone="muted">{a.provider === "microsoft" ? "Outlook" : "Google"}</Pill>
                </div>
                <button
                  onClick={() => disconnect(a.provider, a.id)}
                  disabled={pending}
                  className="text-sm text-muted hover:text-danger flex items-center gap-1.5 disabled:opacity-50"
                  type="button"
                >
                  <Trash2 size={15} /> Disconnect
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <ConnectButton
            href="/api/integrations/google/connect"
            configured={googleConfigured}
            disabled={googleCount >= 2}
            label={googleCount > 0 ? "Add another Google calendar" : "Connect Google Calendar"}
          />
          <ConnectButton
            href="/api/integrations/microsoft/connect"
            configured={microsoftConfigured}
            disabled={microsoftCount >= 2}
            label={microsoftCount > 0 ? "Add another Outlook calendar" : "Connect Outlook"}
          />
        </div>
        {(!googleConfigured || !microsoftConfigured) && (
          <p className="text-xs text-muted mt-3">
            {!googleConfigured && "Google"}
            {!googleConfigured && !microsoftConfigured && " and "}
            {!microsoftConfigured && "Outlook"} credentials aren&apos;t configured on this environment yet.
          </p>
        )}
      </Card>

      {/* Video & conferencing */}
      <Card className="p-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">Video for meetings</h2>
        <p className="text-sm text-muted mb-4">
          Choose how the video link is created for each booking. Google Meet only works when the meeting is
          hosted on a Google calendar; Zoom works with any calendar (Google or Outlook).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 items-start">
          <Field label="Video provider">
            <select value={videoProvider} onChange={(e) => setVideoProvider(e.target.value as VideoProvider)} className={inputClass}>
              <option value="auto">Auto (Meet on Google, Zoom on Outlook)</option>
              <option value="google_meet">Always Google Meet (hosts on Google)</option>
              <option value="zoom">Always Zoom</option>
            </select>
            <p className="text-xs text-muted mt-1.5">Saved with your booking page below.</p>
          </Field>
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">Zoom account</label>
            {zoomEmail ? (
              <div className="flex items-center justify-between border border-line rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-olive-tint text-[#15803D] flex items-center justify-center">
                    <Video size={15} />
                  </span>
                  <span className="text-sm font-medium text-ink">{zoomEmail}</span>
                </div>
                <button onClick={removeZoom} disabled={pending} type="button" className="text-sm text-muted hover:text-danger flex items-center gap-1.5 disabled:opacity-50">
                  <Trash2 size={15} /> Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/integrations/zoom/connect"
                className={`inline-flex items-center gap-2 rounded-full bg-brick text-white font-semibold px-5 py-2.5 text-sm hover:bg-brick-dark transition-colors ${
                  zoomConfigured ? "" : "pointer-events-none opacity-40"
                }`}
              >
                <PlugZap size={16} /> Connect Zoom
              </a>
            )}
            {!zoomConfigured && <p className="text-xs text-muted mt-2">Zoom isn&apos;t configured on this environment yet.</p>}
          </div>
        </div>
      </Card>

      {/* Booking page settings */}
      <Card className="p-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">Your booking page</h2>
        <p className="text-sm text-muted mb-5">
          Prospects pick an open time on this page. You&apos;ll both get a calendar invite with a video link.
        </p>

        <Field label="Booking link">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted whitespace-nowrap">{baseUrl}/book/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputClass}
              placeholder="your-name"
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="text-sm text-brick font-medium inline-flex items-center gap-1.5">
              <Link2 size={14} /> Preview
            </a>
            <button onClick={copyLink} type="button" className="text-sm text-muted hover:text-ink inline-flex items-center gap-1.5">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          <Field label="Page title">
            <input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className={inputClass} placeholder="Book a meeting" />
          </Field>
          <Field label="Time zone">
            <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={inputClass}>
              {BOOKING_TIMEZONES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description (optional)">
          <textarea
            value={pageDescription}
            onChange={(e) => setPageDescription(e.target.value)}
            className={`${inputClass} min-h-[72px]`}
            placeholder="What to expect on the call."
          />
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5">
          <Field label="Meeting length">
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buffer (min)">
            <input type="number" min={0} max={120} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Min notice (hrs)">
            <input type="number" min={0} max={168} value={notice} onChange={(e) => setNotice(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Book out (days)">
            <input type="number" min={1} max={90} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>

        {/* Weekly availability */}
        <div className="mt-2">
          <label className="block text-[13px] font-semibold mb-2 text-ink">Weekly availability</label>
          <AvailabilityEditor rules={rules} onChange={setRules} />
        </div>

        <label className="flex items-center gap-2.5 mt-5 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#b3402f]" />
          <span className="text-sm font-medium text-ink">Booking page is live</span>
          {!connected && <span className="text-xs text-muted">(connect a calendar first)</span>}
        </label>

        <div className="flex items-center gap-3 mt-5">
          <Btn onClick={save} loading={pending} icon={Calendar}>
            Save booking page
          </Btn>
          {msg && (
            <span className={`text-sm ${msg.tone === "ok" ? "text-[#15803D]" : "text-danger"}`}>{msg.text}</span>
          )}
        </div>
      </Card>

      {/* Round-robin Book-a-Demo pool */}
      <DemoPoolCard isSuper={isSuper} inPool={settings.in_demo_pool} memberCount={demoMemberCount} config={demoConfig} />

      {/* Bookings — upcoming to join, recent to mark showed/no-show */}
      <Card className="p-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">Meetings</h2>
        <p className="text-sm text-muted mb-4">Upcoming demos to join, plus the last week&rsquo;s meetings to mark showed or no-show (this updates the CRM).</p>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">No meetings yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {bookings.map((b) => (
              <BookingRowView key={b.id} booking={b} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ConnectButton({
  href,
  configured,
  disabled,
  label,
}: {
  href: string;
  configured: boolean;
  disabled: boolean;
  label: string;
}) {
  if (disabled) return null;
  const off = !configured;
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-full bg-brick text-white font-semibold px-5 py-2.5 text-sm hover:bg-brick-dark transition-colors ${
        off ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <PlugZap size={16} />
      {label}
    </a>
  );
}

function formatBookingDate(iso: string, tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  // An invalid IANA tz makes toLocaleDateString throw — guard so one bad row
  // can't crash the whole page.
  try {
    return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: tz || undefined });
  } catch {
    return new Date(iso).toLocaleDateString("en-US", opts);
  }
}

function BookingRowView({ booking }: { booking: BookingRow }) {
  const dateLabel = formatBookingDate(booking.start_at, booking.time_zone);
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<string | null>(booking.outcome);
  // Capture "now" once on mount (impure to read during render otherwise).
  const [nowMs] = useState(() => Date.now());
  const hasStarted = new Date(booking.start_at).getTime() <= nowMs;

  function mark(next: "showed" | "no_show") {
    start(async () => {
      const res = await markBookingOutcome(booking.id, next);
      if (!res.error) setOutcome(next);
    });
  }

  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink truncate">{booking.invitee_name || booking.invitee_email}</div>
        <div className="text-xs text-muted truncate">
          {dateLabel}
          {booking.time_zone ? ` · ${booking.time_zone}` : ""}
        </div>
      </div>

      {outcome ? (
        <span className={`text-xs font-semibold whitespace-nowrap ${outcome === "showed" ? "text-olive" : "text-muted"}`}>
          {outcome === "showed" ? "✓ Showed" : "No-show"}
        </span>
      ) : hasStarted ? (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => mark("showed")}
            disabled={pending}
            className="text-xs font-semibold text-olive bg-olive-tint rounded-lg px-2.5 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            Showed
          </button>
          <button
            type="button"
            onClick={() => mark("no_show")}
            disabled={pending}
            className="text-xs font-semibold text-charcoal-2 bg-paper border border-line rounded-lg px-2.5 py-1.5 hover:bg-white transition-colors disabled:opacity-40"
          >
            No-show
          </button>
        </div>
      ) : (
        booking.meet_link && (
          <a href={booking.meet_link} target="_blank" rel="noreferrer" className="text-sm text-brick font-medium whitespace-nowrap">
            Join Meet →
          </a>
        )
      )}
    </div>
  );
}
