import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import {
  aggregateBy,
  computeSpotCheckAverages,
  computeStageCounts,
  stageOf,
  statusForCompletion,
  type Discount,
  type GuestWithVisits,
  type SpotCheck,
} from "@/lib/hospitality";
import { computeCoachingFlags } from "@/lib/coaching-flags";
import { getOnboardingStatus } from "@/lib/onboarding";
import { getMomentum } from "@/lib/momentum";
import { computeGuestRevenue } from "@/lib/guest-revenue";
import { MomentumCard } from "@/components/dashboard/momentum-card";
import { GuestSentimentCard } from "@/components/dashboard/guest-sentiment-card";
import { getGuestSentiment } from "@/lib/guest-sentiment";
import { ShiftBoardCard } from "@/components/dashboard/shift-board-card";
import { getTodaysBoard } from "@/lib/shift-board-data";
import { WinsCard } from "@/components/dashboard/wins-card";
import { getRecentWins } from "@/lib/wins-data";
import { getWeeklyMoves } from "@/lib/weekly-moves-data";
import { WeeklyMovesCard } from "./weekly-moves-card";
import { StaffDashboard } from "./staff-dashboard";
import { StaffTests } from "@/components/dashboard/staff-tests";
import { getMyTests, isTestToDo } from "@/lib/data/staff-tests";
import { FIVE_GAPS, constraintGapIndex, scoreTone } from "@/lib/audit";
import { RetentionChart } from "@/components/dashboard/retention-chart";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { WeekVerdict } from "@/components/dashboard/week-verdict";
import { weeklyBuckets, thisVsLast, repeatRateSeries, repeatRateAsOf } from "@/lib/dashboard-trends";
import { StatusPill } from "@/components/ui/status-pill";
import { ArrowUpRight, ArrowRight, ClipboardCheck, Rocket, Sparkle, TrendingUp } from "lucide-react";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function daysAgoIso(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  // The developer role is API-only — its home is the API access page.
  if (profile.accessRole === "developer") redirect("/api-access");
  // Staff get a personal dashboard (their tests, training, checklist, focus) —
  // not the restaurant-wide manager view. Branch out before the heavy manager
  // data fetching below.
  if (profile.accessRole === "staff") {
    return <StaffDashboard profile={profile} />;
  }
  const isSuperAdmin = profile.accessRole === "super_admin";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const onboarding = isSuperAdmin ? await getOnboardingStatus() : null;
  // Momentum drives the "this week" verdict's next-move even before setup is
  // finished; the full Momentum CARD is still held back until setup is done
  // (during setup, Start Here drives the habits).
  const momentum = isSuperAdmin ? await getMomentum(effectiveLocation) : null;
  const weeklyMoves = isSuperAdmin && onboarding?.allDone ? await getWeeklyMoves() : null;
  const supabase = await createClient();

  const [
    { data: guests },
    discountsQuery,
    spotChecksQuery,
    dailyChecksQuery,
    signoffsQuery,
    { count: signoffsThisWeek },
    { count: cultureMomentsThisQtr },
    cultureMomentsQuery,
    coachingLogsQuery,
    locations,
    { data: org },
    auditQuery,
    bizHealthQuery,
    preshiftActivityQuery,
  ] = await Promise.all([
    supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes, bill_total)"),
    scoped(supabase.from("discounts").select("*"), effectiveLocation),
    scoped(supabase.from("spot_checks").select("id, staff_name, scores, created_at"), effectiveLocation),
    scoped(supabase.from("daily_checklists").select("*").order("occurred_on", { ascending: false }).limit(1), effectiveLocation),
    scoped(
      supabase
        .from("training_signoffs")
        .select("id, staff_name, department, completion_pct, occurred_on, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      effectiveLocation
    ),
    scoped(
      supabase.from("training_signoffs").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(SEVEN_DAYS_MS)),
      effectiveLocation
    ),
    supabase.from("culture_moments").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(NINETY_DAYS_MS)),
    supabase.from("culture_moments").select("id, author, about, created_at").order("created_at", { ascending: false }).limit(4),
    scoped(supabase.from("coaching_logs").select("id, flag_text, created_at").order("created_at", { ascending: false }).limit(4), effectiveLocation),
    getOrgLocations(),
    supabase.from("organizations").select("weekly_focus, total_revenue").single(),
    scoped(
      supabase
        .from("audits")
        .select("health_score, gap_scores, occurred_on")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
      effectiveLocation
    ),
    scoped(
      supabase
        .from("business_health_metrics")
        .select("net_sales, labor_cost, labor_hours, comp_cost, covers, checks, seats, period_date")
        .order("period_date", { ascending: false })
        .limit(1),
      effectiveLocation
    ),
    scoped(
      supabase
        .from("shift_checklist_completions")
        .select("completed_count, item_count, created_at, updated_at, profiles(full_name)")
        .eq("checklist_type", "preshift")
        .gte("occurred_on", daysAgoIso(SEVEN_DAYS_MS).slice(0, 10))
        .order("updated_at", { ascending: false })
        .limit(6),
      effectiveLocation
    ),
  ]);

  const latestAudit = (auditQuery.data ?? [])[0] as
    | { health_score: number; gap_scores: number[]; occurred_on: string }
    | undefined;
  const auditConstraint = latestAudit ? FIVE_GAPS[constraintGapIndex(latestAudit.gap_scores)] : null;

  // Business health card: derive the six ratios from the latest week of raw POS
  // inputs (pushed via POST /api/v1/business-health). Stays a placeholder until
  // a POS integration sends data.
  const bh = (bizHealthQuery.data ?? [])[0] as
    | { net_sales: number; labor_cost: number; labor_hours: number; comp_cost: number; covers: number; checks: number; seats: number | null; period_date: string }
    | undefined;

  const preshiftCompletions = (preshiftActivityQuery.data ?? []) as {
    completed_count: number;
    item_count: number;
    created_at: string;
    updated_at: string | null;
    profiles: { full_name: string } | null;
  }[];

  const discounts = (discountsQuery.data ?? []) as Discount[];
  const spotChecks = (spotChecksQuery.data ?? []) as (SpotCheck & { created_at: string })[];
  const lastDailyCheck = (dailyChecksQuery.data ?? [])[0] as { checked: boolean[]; manager_name: string; created_at: string } | undefined;
  const signoffs = (signoffsQuery.data ?? []) as { id: string; staff_name: string; department: string; completion_pct: number; occurred_on: string; created_at: string }[];
  const cultureMoments = (cultureMomentsQuery.data ?? []) as { id: string; author: string; about: string; created_at: string }[];
  const coachingLogs = (coachingLogsQuery.data ?? []) as { id: string; flag_text: string; created_at: string }[];
  const allGuests = (guests ?? []) as GuestWithVisits[];
  // Guest retention is per-location: a guest belongs to the location of their
  // first visit (same attribution as the per-location benchmarks below). Scope
  // the retention funnel, repeat rate, and follow-up counts to the selected
  // location so the headline KPI + chart match the rest of the dashboard rather
  // than blending every location together. "All locations" keeps the full set.
  const scopedGuests = effectiveLocation
    ? allGuests.filter((g) => g.guest_visits.find((v) => v.visit_number === 1)?.location_id === effectiveLocation)
    : allGuests;
  const stageCounts = computeStageCounts(scopedGuests);
  const guestsAwaitingFollowUp = scopedGuests.filter((g) => stageOf(g.guest_visits) === 1).length;
  const returningGuestCount = scopedGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;

  // First-run: no guests, spot-checks, sign-offs, or culture moments yet. In that
  // state we show an inviting "here's what this looks like" preview instead of a
  // wall of zeros. Any real data flips the dashboard to live numbers + trends.
  const isEmptyDashboard =
    stageCounts.total === 0 && spotChecks.length === 0 && (signoffsThisWeek ?? 0) === 0 && (cultureMomentsThisQtr ?? 0) === 0;

  // KPI trends (real, week-over-week). Skipped for the empty state. Weekly series
  // for the countable KPIs come from a light date-only fetch; the repeat-rate
  // trend is recomputed from the guest visits already in memory.
  const TREND_WEEKS = 6;
  const WEEK_MS = 7 * 86400000;
  const nowMs = Date.now();
  let trend: null | {
    repeatNow: number;
    repeatDelta: number;
    repeatSeries: number[];
    spot: { value: number; delta: number; series: number[] };
    signoff: { value: number; delta: number; series: number[] };
    culture: { value: number; delta: number; series: number[] };
  } = null;
  if (!isEmptyDashboard) {
    const sinceIso = new Date(nowMs - TREND_WEEKS * WEEK_MS).toISOString().slice(0, 10);
    const col = (rows: unknown[] | null | undefined) => ((rows ?? []) as { occurred_on: string }[]).map((r) => r.occurred_on);
    const [spotDates, signoffDates, cultureDates] = await Promise.all([
      scoped(supabase.from("spot_checks").select("occurred_on").gte("occurred_on", sinceIso).limit(3000), effectiveLocation),
      scoped(supabase.from("training_signoffs").select("occurred_on").gte("occurred_on", sinceIso).limit(3000), effectiveLocation),
      supabase.from("culture_moments").select("occurred_on").gte("occurred_on", sinceIso).limit(3000),
    ]);
    const spotBuckets = weeklyBuckets(col(spotDates.data), nowMs, TREND_WEEKS);
    const signoffBuckets = weeklyBuckets(col(signoffDates.data), nowMs, TREND_WEEKS);
    const cultureBuckets = weeklyBuckets(col(cultureDates.data), nowMs, TREND_WEEKS);
    const repeatNow = stageCounts.pct[1] || 0;
    trend = {
      repeatNow,
      repeatDelta: repeatNow - repeatRateAsOf(scopedGuests, nowMs - WEEK_MS),
      repeatSeries: repeatRateSeries(scopedGuests, nowMs, TREND_WEEKS),
      spot: { value: spotChecks.length, delta: thisVsLast(spotBuckets).delta, series: spotBuckets },
      signoff: { value: signoffsThisWeek ?? 0, delta: thisVsLast(signoffBuckets).delta, series: signoffBuckets },
      culture: { value: cultureMomentsThisQtr ?? 0, delta: thisVsLast(cultureBuckets).delta, series: cultureBuckets },
    };
  }

  const bhMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const bhMetrics = bh
    ? (() => {
        const seatBasis = bh.seats && bh.seats > 0 ? bh.seats : bh.covers;
        const avgCheck = bh.checks > 0 ? bh.net_sales / bh.checks : null;
        return [
          { label: "Revenue / seat", value: seatBasis > 0 ? bhMoney(bh.net_sales / seatBasis) : "—" },
          { label: "Revenue / labor hr", value: bh.labor_hours > 0 ? bhMoney(bh.net_sales / bh.labor_hours) : "—" },
          { label: "Comp cost", value: bhMoney(bh.comp_cost) },
          { label: "Retention $ impact", value: avgCheck != null ? bhMoney(returningGuestCount * avgCheck) : "—" },
          { label: "Avg check", value: avgCheck != null ? bhMoney(avgCheck) : "—" },
          { label: "Labor %", value: bh.net_sales > 0 ? `${Math.round((bh.labor_cost / bh.net_sales) * 100)}%` : "—" },
        ];
      })()
    : null;

  const guestsByFirstLocation = new Map<string, GuestWithVisits[]>();
  for (const g of allGuests) {
    const firstVisitLocation = g.guest_visits.find((v) => v.visit_number === 1)?.location_id;
    if (!firstVisitLocation) continue;
    const arr = guestsByFirstLocation.get(firstVisitLocation) ?? [];
    arr.push(g);
    guestsByFirstLocation.set(firstVisitLocation, arr);
  }
  const locationBenchmarks = locations
    .map((loc) => {
      const guestsHere = guestsByFirstLocation.get(loc.id) ?? [];
      const returned = guestsHere.filter((g) => stageOf(g.guest_visits) >= 2).length;
      return {
        name: loc.name,
        pct: guestsHere.length > 0 ? Math.round((returned / guestsHere.length) * 100) : 0,
        total: guestsHere.length,
      };
    })
    .sort((a, b) => b.pct - a.pct);
  const groupAveragePct =
    locationBenchmarks.length > 0
      ? Math.round(locationBenchmarks.reduce((s, l) => s + l.pct, 0) / locationBenchmarks.length)
      : 0;

  // Retention program ROI — actual dollars from repeat visits (the money the
  // bounce-back program brought back). Scoped to the selected location; when
  // viewing all locations, also broken out per location.
  const programRevenue = computeGuestRevenue(scopedGuests);
  const programRoiByLocation = locations
    .map((loc) => ({ name: loc.name, repeat: computeGuestRevenue(guestsByFirstLocation.get(loc.id) ?? []).repeatRevenue }))
    .filter((l) => l.repeat > 0)
    .sort((a, b) => b.repeat - a.repeat);

  const discountTotal = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const byCategory = aggregateBy(discounts, (d) => d.category, (d) => Number(d.amount));
  // Real comp rate as a % of revenue (matches the Accountability page), so the
  // "discounts drifting high" coaching flag can actually fire here.
  const orgRevenue = Number((org as { total_revenue?: number } | null)?.total_revenue ?? 0);
  const discountPct = orgRevenue > 0 ? ((discountTotal / orgRevenue) * 100).toFixed(1) : "0.0";
  const staffAverages = computeSpotCheckAverages(spotChecks);

  const flags = computeCoachingFlags({
    discountPct,
    byCategory,
    guestsAwaitingFollowUp,
    staffAverages,
    lastDailyCheck,
  });

  const activity = [
    ...signoffs.map((s) => ({
      who: initialsOf(s.staff_name),
      text: `${s.staff_name} signed off ${s.department} training at ${s.completion_pct}%`,
      created_at: s.created_at,
      tone: statusForCompletion(s.completion_pct),
    })),
    ...cultureMoments.map((c) => ({
      who: initialsOf(c.author),
      text: `${c.author} logged a culture moment for ${c.about}`,
      created_at: c.created_at,
      tone: { fg: "text-brick-dark", bg: "bg-brick-tint", dot: "", label: "" },
    })),
    ...coachingLogs.map((c) => ({
      who: "!",
      text: `Coaching flagged: ${c.flag_text}`,
      created_at: c.created_at,
      tone: { fg: "text-[#B45309]", bg: "bg-[#FDF3E1]", dot: "", label: "" },
    })),
    ...preshiftCompletions.map((p) => {
      const name = p.profiles?.full_name ?? "A team member";
      return {
        who: initialsOf(name),
        text: `${name} completed their pre-shift checklist (${p.completed_count}/${p.item_count})`,
        created_at: p.updated_at ?? p.created_at,
        tone: { fg: "text-[#15803d]", bg: "bg-[#E7F6EC]", dot: "", label: "" },
      };
    }),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  // Managers/owners take tests too — surface any they still owe, right on their
  // (otherwise full) dashboard. Empty (and hidden) if they're not on the roster.
  const myTests = await getMyTests(profile.userId, profile.orgId);
  const myToDo = myTests.filter(isTestToDo);

  const firstName = profile.fullName.split(" ")[0] || "there";
  const greetingLocation = effectiveLocation
    ? locations.find((l) => l.id === effectiveLocation)?.name ?? "your location"
    : "every location";

  // Pair the "this week" cards and the two status pills side-by-side on desktop
  // (instead of a tall stack) to declutter the top of the page.
  const showMomentum = Boolean(momentum && onboarding?.allDone);
  const showMoves = Boolean(weeklyMoves);
  const showFocus = Boolean(org?.weekly_focus);
  const showAudit = Boolean(latestAudit && auditConstraint);
  const guestSentiment = await getGuestSentiment(profile.orgId, effectiveLocation);
  const shiftBoard = await getTodaysBoard(profile.orgId, effectiveLocation, profile.locationTimezone);
  const wins = await getRecentWins(profile.orgId, profile.userId, 4);

  return (
    <>
      <GreetingHeader firstName={firstName} greetingLocation={greetingLocation} />

      <ShiftBoardCard notes={shiftBoard} />
      <WinsCard wins={wins} />
      <GuestSentimentCard sentiment={guestSentiment} />

      {onboarding && onboarding.doneCount === 0 && (
        <div className="bg-[#0A0A0A] rounded-[20px] p-7 sm:p-9 text-white">
          <div className="flex items-center gap-2 text-[#4D97FF] mb-3">
            <Rocket size={16} />
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Welcome to Wingman</span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.01em] leading-[1.25] max-w-[640px]">
            Let&rsquo;s set up {profile.orgName || "your restaurant"}, {firstName}.
          </h2>
          <p className="text-[15px] text-[#c9c9c9] mt-2.5 max-w-[560px] leading-[1.5]">
            Answer a few quick questions and Wingman drafts your culture, standards, and training around your restaurant — about 3 minutes. You can change anything after.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Link href="/wizard" className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors">
              Start setup — 3 min
            </Link>
            <Link href="/start-here" className="text-[15px] font-semibold text-white/90 border border-white/25 rounded-full px-5 py-3 hover:bg-white/10 transition-colors">
              See all the steps
            </Link>
          </div>
        </div>
      )}

      {onboarding && !onboarding.allDone && onboarding.doneCount > 0 && (
        <Link
          href="/start-here"
          className="flex items-center gap-3 bg-brick-tint rounded-2xl px-6 py-4 hover:brightness-[0.98] transition-[filter]"
        >
          <Rocket size={16} className="text-brick shrink-0" />
          <span className="text-sm text-brick-dark flex-1">
            <span className="font-semibold">Finish setting up your account</span> — {onboarding.doneCount} of {onboarding.steps.length} steps done.
          </span>
          <span className="text-sm font-semibold text-brick-dark whitespace-nowrap">Start here →</span>
        </Link>
      )}

      {!isEmptyDashboard && stageCounts.total > 0 && trend && (
        <WeekVerdict repeatRate={trend.repeatNow} repeatDelta={trend.repeatDelta} momentum={momentum} />
      )}

      {(showMomentum || showMoves) && (
        <div className={`grid grid-cols-1 gap-5 ${showMomentum && showMoves ? "lg:grid-cols-2 items-start" : ""}`}>
          {momentum && onboarding?.allDone && <MomentumCard momentum={momentum} />}
          {weeklyMoves && (
            <WeeklyMovesCard
              initialMoves={weeklyMoves.moves}
              weekLabel={new Date(`${weeklyMoves.weekStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
            />
          )}
        </div>
      )}

      {(showFocus || showAudit) && (
        <div className={`grid grid-cols-1 gap-4 ${showFocus && showAudit ? "lg:grid-cols-2 items-stretch" : ""}`}>
          {org?.weekly_focus && (
            <Link
              href="/culture"
              className="flex items-center gap-3 bg-gold-tint rounded-2xl px-6 py-4 hover:brightness-[0.98] transition-[filter]"
            >
              <Sparkle size={16} className="text-[#b45309] shrink-0" />
              <span className="text-sm text-[#b45309]">
                <span className="font-semibold">This week&apos;s pre-shift focus:</span> {org.weekly_focus}
              </span>
            </Link>
          )}

          {latestAudit && auditConstraint && (
            <Link
              href="/audit"
              className="flex items-center gap-3 bg-white border border-line rounded-2xl px-6 py-4 hover:brightness-[0.98] transition-[filter]"
            >
              <ClipboardCheck size={16} className="text-brick shrink-0" />
              <span className="flex items-center gap-2 text-sm text-ink flex-1 min-w-0">
                <span className={`inline-flex items-center gap-1.5 font-semibold ${scoreTone(latestAudit.health_score).fg}`}>
                  <span className={`w-2 h-2 rounded-full ${scoreTone(latestAudit.health_score).dot}`} />
                  Health Score {latestAudit.health_score}
                </span>
                <span className="text-muted-2">·</span>
                <span className="text-muted truncate">
                  Fix first: <span className="font-semibold text-ink">{auditConstraint.label}</span>
                </span>
              </span>
              <span className="text-sm font-semibold text-brick whitespace-nowrap flex items-center gap-1">
                Open audit <ArrowUpRight size={13} />
              </span>
            </Link>
          )}
        </div>
      )}

      {isEmptyDashboard ? (
        <div data-tour="kpis">
          <p className="text-[12.5px] text-muted-2 mb-2.5">
            A preview of what you&rsquo;ll see here — your real numbers fill in as your team logs shifts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard sample label="Repeat rate" value="38%" sub="back for visit 2" delta={4} deltaUnit="pt" series={[28, 30, 29, 33, 35, 38]} />
            <KpiCard sample label="Spot-checks logged" value="12" sub="across all departments" delta={3} series={[1, 2, 2, 3, 2, 3]} />
            <KpiCard sample label="Sign-offs this week" value="9" sub="logged in the last 7 days" delta={2} series={[3, 4, 5, 4, 7, 9]} />
            <KpiCard sample label="Culture moments" value="7" sub="recognized this quarter" delta={5} series={[0, 1, 2, 3, 5, 7]} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" data-tour="kpis">
          <KpiCard label="Repeat rate" value={`${trend?.repeatNow ?? stageCounts.pct[1] ?? 0}%`} sub="back for visit 2" delta={trend?.repeatDelta} deltaUnit="pt" series={trend?.repeatSeries} />
          <KpiCard label="Spot-checks logged" value={String(spotChecks.length)} sub="across all departments" delta={trend?.spot.delta} series={trend?.spot.series} />
          <KpiCard label="Sign-offs this week" value={String(signoffsThisWeek ?? 0)} sub="logged in the last 7 days" delta={trend?.signoff.delta} series={trend?.signoff.series} />
          <KpiCard label="Culture moments" value={String(cultureMomentsThisQtr ?? 0)} sub="recognized this quarter" delta={trend?.culture.delta} series={trend?.culture.series} />
        </div>
      )}

      {myToDo.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[15px] font-semibold text-ink">Your tests to take</span>
            <span className="text-xs font-bold text-brick bg-brick-tint px-2 py-0.5 rounded-full">{myToDo.length}</span>
          </div>
          <StaffTests tests={myToDo} emptyLabel="" />
        </div>
      )}

      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Your shift</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Link
          href="/accountability"
          className="flex items-center gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm hover:border-brick transition-colors group"
        >
          <span className="w-11 h-11 rounded-[12px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Your pre-shift checklist</div>
            <div className="text-[13px] text-muted-2">Run your own checklist before the shift — just like the rest of the team.</div>
          </div>
          <ArrowRight size={17} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>
      </div>

      {programRevenue.billedVisits > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div>
              <div className="flex items-center gap-1.5 text-olive mb-1">
                <TrendingUp size={15} />
                <span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#4d7c0f]">Retention program ROI</span>
              </div>
              <div className="text-[30px] font-bold tracking-[-0.02em] leading-none tabular-nums text-ink">
                {bhMoney(programRevenue.repeatRevenue)}
              </div>
              <p className="text-[12.5px] text-muted mt-1.5 max-w-sm leading-snug">
                Actual revenue your repeat visits brought back{effectiveLocation ? ` at ${greetingLocation}` : " across every location"} — of {bhMoney(programRevenue.total)} logged.{" "}
                <Link href="/reporting" className="text-brick font-semibold whitespace-nowrap">Full breakdown →</Link>
              </p>
            </div>
            {!effectiveLocation && programRoiByLocation.length > 1 && (
              <div className="flex-1 min-w-[220px]">
                <div className="text-[11px] font-semibold text-muted-2 uppercase tracking-wide mb-2.5">By location</div>
                <div className="flex flex-col gap-2">
                  {programRoiByLocation.slice(0, 4).map((l) => {
                    const max = programRoiByLocation[0].repeat || 1;
                    return (
                      <div key={l.name}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12.5px] text-charcoal-2">{l.name}</span>
                          <span className="text-[12.5px] font-semibold tabular-nums text-ink">{bhMoney(l.repeat)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F1F1F1] overflow-hidden">
                          <div className="h-full rounded-full bg-olive" style={{ width: `${Math.round((l.repeat / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Retention &amp; operations</div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm" data-tour="retention">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Guest retention</div>
              <div className="text-[13px] text-muted mt-0.5">How many guests reach each return visit, out of {stageCounts.total} tracked</div>
            </div>
          </div>
          <div className="mt-3">
            <RetentionChart counts={stageCounts.counts} labels={["Visit 1", "Visit 2", "Visit 3", "Visit 4"]} />
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-[18px]">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Needs your attention</span>
            {flags.length > 0 && (
              <span className="text-xs font-bold text-danger bg-danger-tint px-2.5 py-0.5 rounded-full">{flags.length}</span>
            )}
          </div>
          {flags.length > 0 ? (
            <div className="flex flex-col gap-3">
              {flags.slice(0, 3).map((f, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-[#FAFAFA]">
                  <span
                    className={`shrink-0 w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-sm ${
                      f.tone === "danger" ? "bg-danger-tint text-danger" : "bg-[#FDF3E1] text-[#D97706]"
                    }`}
                  >
                    !
                  </span>
                  <div className="text-sm leading-[1.35] text-ink">{f.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Nothing needs attention right now.</p>
          )}
          <div className="mt-auto pt-4">
            <Link href="/accountability" className="text-sm font-semibold text-brick flex items-center gap-1">
              View all flags <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Sign-off log</span>
          </div>
          {signoffs.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] text-left">
                  <th className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Standard</th>
                  <th className="px-4 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Owner</th>
                  <th className="px-4 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Status</th>
                  <th className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Date</th>
                </tr>
              </thead>
              <tbody>
                {signoffs.map((s) => {
                  const status = statusForCompletion(s.completion_pct);
                  return (
                    <tr key={s.id}>
                      <td className="px-6 py-3.5 border-b border-[#F5F5F5]">
                        <div className="font-medium text-ink capitalize">{s.department} training</div>
                        <div className="text-xs text-muted-2 mt-0.5">{s.completion_pct}% complete</div>
                      </td>
                      <td className="px-4 py-3.5 text-charcoal-2 border-b border-[#F5F5F5]">{s.staff_name}</td>
                      <td className="px-4 py-3.5 border-b border-[#F5F5F5]">
                        <StatusPill label={status.label} fg={status.fg} bg={status.bg} dot={status.dot} />
                      </td>
                      <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5] tabular-nums">
                        {new Date(s.occurred_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted p-6">No training sign-offs logged yet.</p>
          )}
        </div>

        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-5">Recent activity</div>
          {activity.length > 0 ? (
            <div className="flex flex-col">
              {activity.map((a, i) => (
                <div key={i} className="flex gap-3 pb-[18px]">
                  <div className="flex flex-col items-center">
                    <span className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${a.tone.bg} ${a.tone.fg}`}>
                      {a.who}
                    </span>
                    {i < activity.length - 1 && <span className="w-[1.5px] flex-1 bg-[#F1F1F1] mt-1" />}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-sm leading-[1.4] text-ink">{a.text}</div>
                    <div className="text-xs text-muted-2 mt-0.5">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No recent activity yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <div className="bg-[#0A0A0A] rounded-2xl p-7 text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em]">Business health</div>
              <div className="text-[13px] text-[#A1A1A1] mt-0.5">
                {bhMetrics && bh
                  ? `Week of ${new Date(bh.period_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · synced from your POS`
                  : "Unlocks once Wingman is connected to your POS."}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
            {(bhMetrics ??
              ["Revenue / seat", "Revenue / labor hr", "Comp cost", "Retention $ impact", "Avg check", "Labor %"].map(
                (label) => ({ label, value: "—" })
              )).map((m) => (
              <div key={m.label} className={`border-t border-[#2A2A2A] pt-3.5 ${bhMetrics ? "" : "opacity-50"}`}>
                <div className="text-[13px] text-[#A1A1A1] font-medium">{m.label}</div>
                <div className="text-2xl font-bold tracking-[-0.02em] leading-none mt-2">{m.value}</div>
              </div>
            ))}
          </div>
          {!bhMetrics && (
            <Link href="/help/api-and-integrations" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4D97FF] mt-6 hover:opacity-80">
              Connect your POS <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {locationBenchmarks.length > 0 && (
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-[18px]">
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Locations · repeat rate</span>
            </div>
            <div className="flex flex-col gap-4">
              {locationBenchmarks.map((l) => (
                <div key={l.name}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-ink">{l.name}</span>
                    <span className="text-[13.5px] font-semibold tabular-nums text-ink">{l.pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F1F1F1] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.pct >= groupAveragePct ? "bg-brick" : "bg-[#D97706]"}`}
                      style={{ width: `${l.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-[18px] px-3.5 py-3 rounded-[10px] bg-paper text-[13px] text-charcoal-2">
              Group average <span className="font-bold text-ink">{groupAveragePct}%</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(query: any, effectiveLocation: string | null) {
  return effectiveLocation ? query.eq("location_id", effectiveLocation) : query;
}
