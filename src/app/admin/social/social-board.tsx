"use client";

import { useMemo, useState, useTransition } from "react";
import { PostCard } from "./post-card";
import { approveAllDrafts } from "./actions";
import { SOCIAL_PLATFORMS, SOCIAL_STATUSES, type SocialPost } from "@/lib/social";

type CardPost = SocialPost & { imageUrls: { path: string; url: string }[] };

// One-click approval of every dated draft (moves them all to Scheduled). Count is
// DB-wide, matching what the action approves — not the current filter.
function ApproveAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await approveAllDrafts();
            setMsg(`Scheduled ${r.scheduled}${r.skippedNoDate ? ` · ${r.skippedNoDate} need a date first` : ""}.`);
          });
        }}
        className="text-[13px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Approving…" : `✓ Approve all ${count}`}
      </button>
      {msg && <span className="text-[12.5px] text-olive font-semibold">{msg}</span>}
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-[#d7a55a]",
  scheduled: "bg-brick",
  posted: "bg-olive",
  skipped: "bg-muted-2",
};
const PLATFORM_ABBR: Record<string, string> = { facebook: "FB", instagram: "IG", linkedin: "LI" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Section({ title, items, hint, connected, action }: { title: string; items: CardPost[]; hint?: string; connected: boolean; action?: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <span className="text-[13px] text-muted-2">{items.length}</span>
          {hint && <span className="text-[13px] text-muted">· {hint}</span>}
        </div>
        {action}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {items.map((p) => (
          <PostCard key={p.id} post={p} connected={connected} />
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border transition-colors ${
        active ? "bg-ink text-white border-ink" : "text-charcoal-2 border-line hover:border-brick hover:text-brick"
      }`}
    >
      {children}
    </button>
  );
}

export function SocialBoard({ posts, connected }: { posts: CardPost[]; connected: boolean }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const now = new Date();
  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) => (status === "all" || p.status === status) && (platform === "all" || p.platforms.includes(platform))
      ),
    [posts, status, platform]
  );

  // Counts for the status chips (respecting the platform filter).
  const byStatus = useMemo(() => {
    const m: Record<string, number> = { all: 0, draft: 0, scheduled: 0, posted: 0, skipped: 0 };
    for (const p of posts) {
      if (platform !== "all" && !p.platforms.includes(platform)) continue;
      m.all++;
      m[p.status] = (m[p.status] ?? 0) + 1;
    }
    return m;
  }, [posts, platform]);

  const nowMs = now.getTime();
  const dueNow = filtered.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() <= nowMs);
  const upcoming = filtered.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() > nowMs);
  const drafts = filtered.filter((p) => p.status === "draft");
  const done = filtered.filter((p) => p.status === "posted" || p.status === "skipped");

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            <Chip active={status === "all"} onClick={() => setStatus("all")}>All · {byStatus.all}</Chip>
            {SOCIAL_STATUSES.map((s) => (
              <Chip key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>
                {s.label} · {byStatus[s.key] ?? 0}
              </Chip>
            ))}
          </div>
          <div className="flex gap-1 bg-white border border-line rounded-xl p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`text-[13px] font-semibold px-3.5 py-1.5 rounded-[9px] transition-colors ${view === "list" ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`text-[13px] font-semibold px-3.5 py-1.5 rounded-[9px] transition-colors ${view === "calendar" ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"}`}
            >
              Calendar
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={platform === "all"} onClick={() => setPlatform("all")}>All platforms</Chip>
          {SOCIAL_PLATFORMS.map((p) => (
            <Chip key={p.key} active={platform === p.key} onClick={() => setPlatform(p.key)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">No posts match these filters.</div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-8">
          <Section title="Ready to post now" items={dueNow} hint="scheduled time has arrived" connected={connected} />
          <Section title="Upcoming" items={upcoming} connected={connected} />
          <Section
            title="Drafts"
            items={drafts}
            hint="waiting for your approval"
            connected={connected}
            action={<ApproveAllButton count={posts.filter((p) => p.status === "draft" && p.scheduled_at).length} />}
          />
          <Section title="Posted & skipped" items={done} connected={connected} />
        </div>
      ) : (
        <CalendarView posts={filtered} connected={connected} cursor={cursor} setCursor={setCursor} selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
      )}
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function CalendarView({
  posts,
  connected,
  cursor,
  setCursor,
  selectedDay,
  setSelectedDay,
}: {
  posts: CardPost[];
  connected: boolean;
  cursor: { y: number; m: number };
  setCursor: (c: { y: number; m: number }) => void;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
}) {
  // Bucket scheduled/posted posts by their day; keep undated ones separate.
  const byDay = new Map<string, CardPost[]>();
  const undated: CardPost[] = [];
  for (const p of posts) {
    if (!p.scheduled_at) {
      undated.push(p);
      continue;
    }
    const key = dayKey(new Date(p.scheduled_at));
    const arr = byDay.get(key) ?? [];
    arr.push(p);
    byDay.set(key, arr);
  }

  const first = new Date(cursor.y, cursor.m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayKey = dayKey(new Date());
  const selectedPosts = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  function prev() {
    const m = cursor.m - 1;
    setCursor(m < 0 ? { y: cursor.y - 1, m: 11 } : { y: cursor.y, m });
  }
  function next() {
    const m = cursor.m + 1;
    setCursor(m > 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-[15px] font-semibold text-ink">{MONTHS[cursor.m]} {cursor.y}</span>
          <div className="flex gap-1">
            <button type="button" onClick={prev} className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-lg px-3 py-1 hover:border-brick hover:text-brick">←</button>
            <button type="button" onClick={() => setCursor({ y: new Date().getFullYear(), m: new Date().getMonth() })} className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-lg px-3 py-1 hover:border-brick hover:text-brick">Today</button>
            <button type="button" onClick={next} className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-lg px-3 py-1 hover:border-brick hover:text-brick">→</button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-line bg-paper">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-2 text-center">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} className="min-h-[92px] border-b border-r border-[#F1F1F1] bg-paper/40" />;
            const key = `${cursor.y}-${cursor.m}-${d}`;
            const dayPosts = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedDay(dayPosts.length ? key : null)}
                className={`min-h-[92px] border-b border-r border-[#F1F1F1] p-1.5 text-left align-top flex flex-col gap-1 transition-colors ${isSelected ? "bg-brick-tint" : "hover:bg-paper"}`}
              >
                <span className={`text-[12px] font-semibold ${isToday ? "text-brick" : "text-charcoal-2"}`}>{d}</span>
                {dayPosts.slice(0, 3).map((p) => (
                  <span key={p.id} className="flex items-center gap-1 text-[11px] text-ink truncate">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status]}`} />
                    <span className="truncate">
                      {p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}{" "}
                      {p.platforms.map((x) => PLATFORM_ABBR[x] ?? x).join("/")}
                    </span>
                  </span>
                ))}
                {dayPosts.length > 3 && <span className="text-[11px] text-muted-2">+{dayPosts.length - 3} more</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && selectedPosts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-ink">
            {new Date(Number(selectedDay.split("-")[0]), Number(selectedDay.split("-")[1]), Number(selectedDay.split("-")[2])).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {selectedPosts.map((p) => (
              <PostCard key={p.id} post={p} connected={connected} />
            ))}
          </div>
        </div>
      )}

      {undated.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Undated</h2>
            <span className="text-[13px] text-muted-2">{undated.length}</span>
            <span className="text-[13px] text-muted">· no scheduled time</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {undated.map((p) => (
              <PostCard key={p.id} post={p} connected={connected} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
