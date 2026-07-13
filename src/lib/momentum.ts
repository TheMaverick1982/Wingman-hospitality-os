import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Momentum — a usage score, separate from Business Health. Business Health asks
// "how is the restaurant doing?"; Momentum asks "are you actually running the
// plays?" It's the leading indicator: teams that keep the weekly habits going
// are the ones that get a return. Loss aversion (a streak you don't want to
// break) does a lot of the work.

export type HabitKey = "floorChecks" | "guestLogging" | "checklists" | "recognition" | "training";

export type MomentumHabit = { key: HabitKey; label: string; nudge: string; href: string; active: boolean; count: number };

export type Momentum = {
  score: number; // 0–100 (share of habits active this week)
  activeHabits: number;
  totalHabits: number;
  label: string; // Cold / Warming up / Building / Strong / On fire
  streakWeeks: number; // consecutive prior full weeks at/above the active bar
  habits: MomentumHabit[];
  topGap: MomentumHabit | null; // most important inactive habit to nudge on
  stalled: boolean; // below the active bar this week
};

// A week counts toward a streak (and an org is "not stalled") at 2+ habits.
export const ACTIVE_WEEK_MIN = 2;
const WEEK_MS = 7 * 86400000;
const STREAK_LOOKBACK_WEEKS = 8;

// Priority order = which gap to nudge first. Floor checks and guest capture are
// the two habits most tied to retention, so they lead.
type HabitDef = { key: HabitKey; label: string; nudge: string; href: string };
const HABIT_DEFS: HabitDef[] = [
  { key: "floorChecks", label: "Floor spot-checks", nudge: "Walk the floor and score a shift", href: "/accountability" },
  { key: "guestLogging", label: "First-time guests logged", nudge: "Log a first-time guest into Bounce Back", href: "/bounceback" },
  { key: "checklists", label: "Daily checklists", nudge: "Complete today's manager checklist", href: "/accountability" },
  { key: "recognition", label: "Culture moments", nudge: "Recognize someone doing it right", href: "/culture" },
  { key: "training", label: "Training sign-offs", nudge: "Log a training sign-off", href: "/training" },
];

function labelFor(active: number): string {
  if (active <= 0) return "Cold";
  if (active === 1) return "Warming up";
  if (active === 2) return "Building";
  if (active === 3) return "Strong";
  return "On fire";
}

// Pure: turn per-habit action dates (last ~9 weeks) into the momentum snapshot.
// `datesByHabit[key]` is a list of ISO/`YYYY-MM-DD` dates for that habit.
export function computeMomentum(datesByHabit: Record<HabitKey, string[]>, nowMs: number): Momentum {
  const inWindow = (dates: string[], startMs: number, endMs: number) =>
    dates.reduce((n, d) => {
      const t = new Date(d).getTime();
      return Number.isNaN(t) || t < startMs || t >= endMs ? n : n + 1;
    }, 0);

  const habits: MomentumHabit[] = HABIT_DEFS.map((d) => {
    const count = inWindow(datesByHabit[d.key] ?? [], nowMs - WEEK_MS, nowMs + 1);
    return { key: d.key, label: d.label, nudge: d.nudge, href: d.href, active: count > 0, count };
  });

  const activeHabits = habits.filter((h) => h.active).length;
  const totalHabits = habits.length;

  // Streak: walk back full weeks (week 1 = the 7 days before this one) and count
  // while each stayed at/above the active bar. This week is reported separately
  // as the score, so a slow start to the current week never breaks the streak.
  let streakWeeks = 0;
  for (let w = 1; w <= STREAK_LOOKBACK_WEEKS; w++) {
    const winStart = nowMs - (w + 1) * WEEK_MS;
    const winEnd = nowMs - w * WEEK_MS;
    const activeThatWeek = HABIT_DEFS.filter((d) => inWindow(datesByHabit[d.key] ?? [], winStart, winEnd) > 0).length;
    if (activeThatWeek >= ACTIVE_WEEK_MIN) streakWeeks++;
    else break;
  }

  const topGap = habits.find((h) => !h.active) ?? null;

  return {
    score: Math.round((activeHabits / totalHabits) * 100),
    activeHabits,
    totalHabits,
    label: labelFor(activeHabits),
    streakWeeks,
    habits,
    topGap,
    stalled: activeHabits < ACTIVE_WEEK_MIN,
  };
}

// Fetch each habit's action dates for one org over the streak lookback window.
// Works with either the SSR (RLS-scoped) or service-role admin client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchActionDates(client: any, orgId: string, sinceIso: string): Promise<Record<HabitKey, string[]>> {
  const col = (rows: unknown[] | null, key: string) => ((rows ?? []) as Record<string, string>[]).map((r) => r[key]).filter(Boolean);
  const [spot, guests, checklists, culture, training] = await Promise.all([
    client.from("spot_checks").select("occurred_on").eq("org_id", orgId).gte("occurred_on", sinceIso).limit(2000),
    client.from("guest_visits").select("visit_date").eq("org_id", orgId).eq("visit_number", 1).gte("visit_date", sinceIso).limit(2000),
    client.from("shift_checklist_completions").select("occurred_on").eq("org_id", orgId).gte("occurred_on", sinceIso).limit(2000),
    client.from("culture_moments").select("occurred_on").eq("org_id", orgId).gte("occurred_on", sinceIso).limit(2000),
    client.from("training_signoffs").select("occurred_on").eq("org_id", orgId).gte("occurred_on", sinceIso).limit(2000),
  ]);
  return {
    floorChecks: col(spot.data, "occurred_on"),
    guestLogging: col(guests.data, "visit_date"),
    checklists: col(checklists.data, "occurred_on"),
    recognition: col(culture.data, "occurred_on"),
    training: col(training.data, "occurred_on"),
  };
}

function sinceIso(nowMs: number): string {
  return new Date(nowMs - (STREAK_LOOKBACK_WEEKS + 1) * WEEK_MS).toISOString().slice(0, 10);
}

// Current org (SSR, RLS-scoped).
export async function getMomentum(): Promise<Momentum | null> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return null;
  const now = Date.now();
  const dates = await fetchActionDates(supabase, org.id as string, sinceIso(now));
  return computeMomentum(dates, now);
}

// Specific org via the service-role admin client — used by the stall-nudge cron.
export async function getMomentumForOrg(admin: SupabaseClient, orgId: string): Promise<Momentum> {
  const now = Date.now();
  const dates = await fetchActionDates(admin, orgId, sinceIso(now));
  return computeMomentum(dates, now);
}
