import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// The 14-Day Launch Plan. Restaurants don't get ROI from software they set up
// and never run — the gap is always *implementation velocity*. So instead of a
// flat "someday" checklist, this is a time-boxed plan: each milestone has a
// target day, a detected done-signal, and a status (done / due / overdue), so
// an owner can see at a glance whether they're on track — and the weekly
// accountability email can nudge them on exactly what slipped.
//
// Milestones span two kinds:
//   - "setup"  — build it (wizard, training, team, playbook)
//   - "usage"  — actually run it (log a guest, recognize a win, run a floor check)
// The usage milestones are the ones that turn a purchase into a habit.

export type MilestoneStatus = "done" | "due" | "overdue" | "upcoming";
export type MilestoneKind = "setup" | "usage";

export type LaunchMilestone = {
  key: string;
  label: string;
  description: string;
  href: string;
  kind: MilestoneKind;
  dueByDay: number;
  done: boolean;
  status: MilestoneStatus;
};

export type LaunchPhase = {
  key: string;
  title: string;
  window: string;
  startDay: number;
  milestones: LaunchMilestone[];
};

export type LaunchPlan = {
  dayNumber: number; // 1-based days since signup
  totalDays: number;
  phases: LaunchPhase[];
  doneCount: number;
  totalCount: number;
  allDone: boolean;
  onTrack: boolean;
  overdueCount: number;
  nextActions: LaunchMilestone[]; // up to 3 undone, earliest target first
};

export type LaunchSignals = {
  wizard: boolean;
  training: boolean;
  staff: boolean;
  hiring: boolean;
  playbook: boolean;
  firstGuest: boolean;
  culture: boolean;
  spotCheck: boolean;
};

export const LAUNCH_TOTAL_DAYS = 14;

type PhaseDef = { key: string; title: string; window: string; startDay: number };
type MilestoneDef = {
  key: keyof LaunchSignals;
  phase: string;
  label: string;
  description: string;
  href: string;
  kind: MilestoneKind;
  dueByDay: number;
};

const PHASE_DEFS: PhaseDef[] = [
  { key: "foundation", title: "Set your foundation", window: "Days 1–3", startDay: 1 },
  { key: "team", title: "Bring your team in", window: "Days 4–7", startDay: 4 },
  { key: "guests", title: "Turn on guest retention", window: "Days 8–11", startDay: 8 },
  { key: "habit", title: "Make it a daily habit", window: "Days 12–14", startDay: 12 },
];

// Ordered by target day. dueByDay is 1-based (day 2 = 48h after signup).
const MILESTONE_DEFS: MilestoneDef[] = [
  {
    key: "wizard",
    phase: "foundation",
    label: "Run the Setup Wizard",
    description: "Tell us your concept — we draft your culture statement, values, and starting standards in minutes.",
    href: "/wizard",
    kind: "setup",
    dueByDay: 2,
  },
  {
    key: "training",
    phase: "foundation",
    label: "Build training for your first role",
    description: "Upload what you use, or let Wingman build a training program for at least one department.",
    href: "/training",
    kind: "setup",
    dueByDay: 3,
  },
  {
    key: "staff",
    phase: "team",
    label: "Add your team to Staff",
    description: "Add your people so you can track their training and hold shifts accountable.",
    href: "/staff",
    kind: "setup",
    dueByDay: 5,
  },
  {
    key: "hiring",
    phase: "team",
    label: "Build your hiring criteria",
    description: "Upload your interview guide, or let Wingman draft hiring criteria for a role.",
    href: "/hiring",
    kind: "setup",
    dueByDay: 6,
  },
  {
    key: "playbook",
    phase: "team",
    label: "Write your team playbook",
    description: "Your guides and SOPs in one place — everyone on the team can read them under Help.",
    href: "/help",
    kind: "setup",
    dueByDay: 7,
  },
  {
    key: "firstGuest",
    phase: "guests",
    label: "Log your first first-time guest",
    description: "This is the engine: capture a new guest and start their Bounce Back so they come back.",
    href: "/bounceback",
    kind: "usage",
    dueByDay: 9,
  },
  {
    key: "culture",
    phase: "guests",
    label: "Recognize a culture moment",
    description: "Catch someone doing it right and log it. Recognized behavior is repeated behavior.",
    href: "/culture",
    kind: "usage",
    dueByDay: 10,
  },
  {
    key: "spotCheck",
    phase: "habit",
    label: "Run your first floor spot-check",
    description: "Walk the floor and score a shift. This is the weekly habit that keeps standards real.",
    href: "/accountability",
    kind: "usage",
    dueByDay: 13,
  },
];

function statusFor(done: boolean, dayNumber: number, startDay: number, dueByDay: number): MilestoneStatus {
  if (done) return "done";
  if (dayNumber > dueByDay) return "overdue";
  if (dayNumber >= startDay) return "due";
  return "upcoming";
}

// Pure: turn detected signals + the org's age into the dated plan. Kept free of
// any I/O so it's unit-testable and reusable by both the page and the cron.
export function computeLaunchPlan(signals: LaunchSignals, createdAtMs: number, nowMs: number): LaunchPlan {
  const dayNumber = Math.max(1, Math.floor((nowMs - createdAtMs) / 86400000) + 1);
  const startDayFor = new Map(PHASE_DEFS.map((p) => [p.key, p.startDay]));

  const all: LaunchMilestone[] = MILESTONE_DEFS.map((d) => {
    const done = signals[d.key];
    const startDay = startDayFor.get(d.phase) ?? d.dueByDay;
    return {
      key: d.key,
      label: d.label,
      description: d.description,
      href: d.href,
      kind: d.kind,
      dueByDay: d.dueByDay,
      done,
      status: statusFor(done, dayNumber, startDay, d.dueByDay),
    };
  });

  const phases: LaunchPhase[] = PHASE_DEFS.map((p) => ({
    key: p.key,
    title: p.title,
    window: p.window,
    startDay: p.startDay,
    milestones: all.filter((_, i) => MILESTONE_DEFS[i].phase === p.key),
  }));

  const doneCount = all.filter((m) => m.done).length;
  const overdueCount = all.filter((m) => m.status === "overdue").length;
  const nextActions = all
    .filter((m) => !m.done)
    .sort((a, b) => a.dueByDay - b.dueByDay)
    .slice(0, 3);

  return {
    dayNumber,
    totalDays: LAUNCH_TOTAL_DAYS,
    phases,
    doneCount,
    totalCount: all.length,
    allDone: doneCount === all.length,
    onTrack: overdueCount === 0,
    overdueCount,
    nextActions,
  };
}

// Detect the launch signals for one org. Works with either the SSR (RLS-scoped)
// client or the service-role admin client — both expose `.from`, and the org is
// always pinned with an explicit org_id filter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSignals(client: any, orgId: string, systemGenerated: boolean): Promise<LaunchSignals> {
  const [
    { count: wingmanStandards },
    { count: wingmanTraining },
    { count: wingmanTraits },
    { count: staffCount },
    { count: playbookCount },
    { count: guestCount },
    { count: cultureCount },
    { count: spotCheckCount },
  ] = await Promise.all([
    client.from("department_standards").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    client.from("department_training_items").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    client.from("hiring_traits").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    client.from("staff_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    client.from("playbook_articles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    client.from("guests").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    client.from("culture_moments").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    client.from("spot_checks").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  return {
    wizard: systemGenerated,
    training: (wingmanStandards ?? 0) + (wingmanTraining ?? 0) > 0,
    staff: (staffCount ?? 0) > 0,
    hiring: (wingmanTraits ?? 0) > 0,
    playbook: (playbookCount ?? 0) > 0,
    firstGuest: (guestCount ?? 0) > 0,
    culture: (cultureCount ?? 0) > 0,
    spotCheck: (spotCheckCount ?? 0) > 0,
  };
}

// Load the current org's launch signals (SSR, RLS-scoped) and compute the plan.
export async function getLaunchPlan(): Promise<LaunchPlan | null> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, created_at, system_generated").single();
  if (!org) return null;

  const signals = await fetchSignals(supabase, org.id as string, !!(org as { system_generated?: boolean }).system_generated);
  const createdAtMs = new Date((org as { created_at: string }).created_at).getTime();
  return computeLaunchPlan(signals, createdAtMs, Date.now());
}

// Same computation for a specific org via the service-role admin client — used
// by the weekly accountability-email cron (no user session in a cron).
export async function getLaunchPlanForOrg(
  admin: SupabaseClient,
  org: { id: string; created_at: string; system_generated?: boolean | null }
): Promise<LaunchPlan> {
  const signals = await fetchSignals(admin, org.id, !!org.system_generated);
  return computeLaunchPlan(signals, new Date(org.created_at).getTime(), Date.now());
}
