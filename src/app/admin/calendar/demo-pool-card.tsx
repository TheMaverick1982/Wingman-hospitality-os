"use client";

import { useState, useTransition } from "react";
import { Users, Star } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { BOOKING_TIMEZONES } from "@/lib/calendar/timezones";
import type { AvailabilityRule } from "@/lib/calendar/availability";
import type { DemoPoolConfig } from "@/lib/calendar/settings";
import { AvailabilityEditor } from "./availability-editor";
import { setDemoPoolMembership, saveDemoPoolConfig } from "./actions";

const DURATIONS = [15, 20, 30, 45, 60];

export function DemoPoolCard({
  isSuper,
  inPool,
  memberCount,
  config,
}: {
  isSuper: boolean;
  inPool: boolean;
  memberCount: number;
  config: DemoPoolConfig;
}) {
  const [joined, setJoined] = useState(inPool);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setMsg(null);
    startTransition(async () => {
      const res = await setDemoPoolMembership(!joined);
      if (res.error) {
        setMsg({ tone: "err", text: res.error });
        return;
      }
      setJoined(!joined);
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
        <h2 className="font-display text-xl font-semibold text-ink">Book-a-Demo pool (round-robin)</h2>
        <Pill tone="muted" dot>
          <Users size={13} /> {memberCount} in pool
        </Pill>
      </div>
      <p className="text-sm text-muted mb-4 max-w-[560px]">
        The public <span className="font-medium text-ink">/book-a-demo</span> page draws from everyone in this
        pool: a time is offered if any of you is free, and each booking is assigned round-robin to a free rep
        (least-loaded first). This replaces the old embedded calendar.
      </p>

      <div className="flex items-center gap-3">
        <Btn kind={joined ? "ghost" : "primary"} onClick={toggle} loading={pending} icon={Star}>
          {joined ? "Leave the demo pool" : "Add my calendar to the pool"}
        </Btn>
        {joined && <span className="text-sm text-[#15803D]">Your calendars are feeding the demo pool.</span>}
        {msg && <span className={`text-sm ${msg.tone === "ok" ? "text-[#15803D]" : "text-danger"}`}>{msg.text}</span>}
      </div>

      {isSuper && <DemoConfigEditor config={config} />}
    </Card>
  );
}

function DemoConfigEditor({ config }: { config: DemoPoolConfig }) {
  const [timeZone, setTimeZone] = useState(config.time_zone);
  const [duration, setDuration] = useState(config.meeting_duration_minutes);
  const [buffer, setBuffer] = useState(config.buffer_minutes);
  const [notice, setNotice] = useState(config.advance_notice_hours);
  const [windowDays, setWindowDays] = useState(config.booking_window_days);
  const [pageTitle, setPageTitle] = useState(config.page_title);
  const [pageDescription, setPageDescription] = useState(config.page_description);
  const [isActive, setIsActive] = useState(config.is_active);
  const [rules, setRules] = useState<AvailabilityRule[]>(config.availability);

  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveDemoPoolConfig({
        timeZone,
        meetingDurationMinutes: duration,
        bufferMinutes: buffer,
        advanceNoticeHours: notice,
        bookingWindowDays: windowDays,
        availability: rules,
        pageTitle,
        pageDescription,
        isActive,
      });
      setMsg(res.error ? { tone: "err", text: res.error } : { tone: "ok", text: "Saved." });
    });
  }

  return (
    <div className="mt-6 pt-6 border-t border-line">
      <h3 className="text-sm font-semibold text-ink mb-1">Shared demo settings</h3>
      <p className="text-xs text-muted mb-4">Owner-only. Controls the demo length, hours, and booking window for the pool.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        <Field label="Demo page title">
          <input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className={inputClass} placeholder="Book a demo" />
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
        <textarea value={pageDescription} onChange={(e) => setPageDescription(e.target.value)} className={`${inputClass} min-h-[64px]`} placeholder="What to expect on the demo." />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5">
        <Field label="Demo length">
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

      <label className="block text-[13px] font-semibold mb-2 text-ink">Demo hours</label>
      <AvailabilityEditor rules={rules} onChange={setRules} />

      <label className="flex items-center gap-2.5 mt-5 cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#b3402f]" />
        <span className="text-sm font-medium text-ink">/book-a-demo is live (uses the pool)</span>
      </label>

      <div className="flex items-center gap-3 mt-5">
        <Btn onClick={save} loading={pending}>
          Save demo settings
        </Btn>
        {msg && <span className={`text-sm ${msg.tone === "ok" ? "text-[#15803D]" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
