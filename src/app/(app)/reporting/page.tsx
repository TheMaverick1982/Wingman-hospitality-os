import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { stageOf, computeSpotCheckAverages, type GuestWithVisits, type SpotCheck } from "@/lib/hospitality";
import { buildPhases } from "@/lib/growth-plan";
import { monthlyRepeatCohorts, monthlyTrainingCompletion, monthlyChecklistCompliance, incentiveEffectiveness, bizHealthTrend, aggregateBizHealthByWeek, type BizHealthRawRow, type ChecklistLite, type IncentiveGuest } from "@/lib/reporting-trends";
import { classifyMenu, QUADRANT_META, type MenuItemRow, type Quadrant } from "@/lib/menu-engineering";
import { computeRoiLedger, DEFAULT_AVG_CHECK, DEFAULT_VISITS_PER_YEAR } from "@/lib/roi-ledger";
import { RoiLedgerCard } from "@/components/reporting/roi-ledger-card";
import { StatTile } from "@/components/ui/stat-tile";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { Heart, RotateCcw, Receipt, GraduationCap, AlertTriangle, Briefcase, TrendingUp } from "lucide-react";
import { ScheduleReportModalButton } from "./schedule-report-modal";
import { ReportNarrative } from "./report-narrative";
import { deleteReportSchedule } from "./actions";

// The AI briefing runs a server action from this route — give it room past the
// short default function timeout.
export const maxDuration = 60;

const RANGES = [
  { key: "7d", label: "7D", days: 7, rangeLabel: "last 7 days" },
  { key: "30d", label: "30D", days: 30, rangeLabel: "last 30 days" },
  { key: "qtr", label: "Quarter", days: 90, rangeLabel: "this quarter" },
] as const;

function cutoffDate(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

// Module-level so the render body stays pure (no direct new Date() in render).
function currentDate(): Date {
  return new Date();
}

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "reporting", profile.permissionOverrides) === "none") redirect("/dashboard");
  const isSuperAdmin = profile.accessRole === "super_admin";

  const { range: rangeParam, location: locationParam } = await searchParams;
  const activeRange = RANGES.find((r) => r.key === rangeParam) ?? RANGES[1];
  const cutoff = cutoffDate(activeRange.days);

  // Honor the top-bar location selector: a specific location scopes every
  // location-aware metric to it; "All locations" keeps the company-wide roll-up
  // (and the By-location comparison table). Shared data — the menu and culture
  // moments — stays org-wide either way.
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: locationParam,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });
  const locationQs = effectiveLocation ? `&location=${effectiveLocation}` : "";
  // Generic so the Supabase query's row types survive the wrapper.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = <T,>(q: T): T => (effectiveLocation ? (q as any).eq("location_id", effectiveLocation) : q);

  const supabase = await createClient();
  const [
    { data: discounts },
    { data: spotChecks },
    { data: signoffs },
    { data: momentCount },
    { data: candidates },
    { data: guests },
    { data: schedules },
    { data: growthPlan },
    { data: bizHealth },
    { data: signoffTrend },
    { data: menuItems },
    { data: audits },
    { data: checklistRows },
    locations,
  ] = await Promise.all([
    scoped(supabase.from("discounts").select("amount, location_id, server_name").gte("occurred_on", cutoff)),
    scoped(supabase.from("spot_checks").select("id, scores, location_id, staff_name, department").gte("occurred_on", cutoff)),
    scoped(supabase.from("training_signoffs").select("id").gte("occurred_on", cutoff)),
    supabase.from("culture_moments").select("id").gte("occurred_on", cutoff),
    scoped(supabase.from("candidates").select("id, recommendation").gte("occurred_on", cutoff)),
    supabase.from("guests").select("id, referred_a_friend, guest_visits(visit_number, visit_date, location_id, reaction, incentive)"),
    supabase.from("report_schedules").select("*").order("created_at", { ascending: false }),
    (effectiveLocation
      ? supabase
          .from("growth_plans")
          .select("current_customers, current_avg_sale, current_repurchase_frequency, target_customers_pct, target_avg_sale_pct, target_frequency_pct")
          .eq("location_id", effectiveLocation)
      : supabase
          .from("growth_plans")
          .select("current_customers, current_avg_sale, current_repurchase_frequency, target_customers_pct, target_avg_sale_pct, target_frequency_pct")
          .is("location_id", null)
    ).maybeSingle(),
    scoped(
      supabase
        .from("business_health_metrics")
        .select("period_date, net_sales, labor_cost, comp_cost, checks, location_id")
        .gte("period_date", cutoffDate(200))
        .order("period_date", { ascending: false })
    ),
    scoped(supabase.from("training_signoffs").select("completion_pct, occurred_on").gte("occurred_on", cutoffDate(190))),
    supabase.from("menu_engineering_items").select("id, name, price, food_cost, popularity"),
    scoped(supabase.from("audits").select("occurred_on, health_score").order("occurred_on", { ascending: false }).limit(8)),
    scoped(supabase.from("shift_checklist_completions").select("occurred_on, item_count, completed_count").gte("occurred_on", cutoffDate(190))),
    getOrgLocations(),
  ]);

  const discountTotal = (discounts ?? []).reduce((s, d) => s + Number(d.amount), 0);
  const spotCheckAvg = spotChecks?.length
    ? spotChecks.reduce((s, sc) => s + sc.scores.reduce((a: number, b: number) => a + b, 0) / sc.scores.length, 0) / spotChecks.length
    : 0;
  const strongFitCount = (candidates ?? []).filter((c) => c.recommendation === "Strong fit").length;

  // Guests carry no location column — attribute each to the location of their
  // first visit (same rule as the dashboard) so a scoped report only counts its
  // own guests' retention, reactions, referrals, cohorts, and ROI.
  const allGuestsRaw = (guests ?? []) as (GuestWithVisits & { referred_a_friend?: boolean })[];
  const allGuests = effectiveLocation
    ? allGuestsRaw.filter((g) => g.guest_visits.find((v) => v.visit_number === 1)?.location_id === effectiveLocation)
    : allGuestsRaw;
  const newGuestsInRange = allGuests.filter((g) =>
    g.guest_visits.some((v) => v.visit_number === 1 && v.visit_date && v.visit_date >= cutoff)
  );
  const returnedCount = newGuestsInRange.filter((g) => stageOf(g.guest_visits) >= 2).length;
  const retentionPct = newGuestsInRange.length > 0 ? Math.round((returnedCount / newGuestsInRange.length) * 100) : 0;

  const visitsInRange = allGuests.flatMap((g) => g.guest_visits).filter((v) => v.visit_date && v.visit_date >= cutoff);
  const positiveReactions = visitsInRange.filter((v) => v.reaction === "wowed" || v.reaction === "delighted").length;
  const flatReactions = visitsInRange.filter((v) => v.reaction === "neutral" || v.reaction === "let_down").length;
  const reactionRatioLabel = flatReactions > 0 ? `${(positiveReactions / flatReactions).toFixed(1)}:1` : positiveReactions > 0 ? "∞" : "—";

  const referredCount = allGuests.filter((g) => g.referred_a_friend).length;
  const referralRate = allGuests.length > 0 ? Math.round((referredCount / allGuests.length) * 100) : 0;

  // ROI ledger — real dollars against the guest work. Captured = first-timers
  // won back (ever returned); at risk = one-and-done first-timers whose first
  // visit is old enough (30d+) that they've had a fair chance to return.
  const returnWindowCutoff = cutoffDate(30);
  const returnedRegulars = allGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;
  const atRiskFirstTimers = allGuests.filter((g) => {
    if (stageOf(g.guest_visits) !== 1) return false;
    const firstVisit = g.guest_visits.find((v) => v.visit_number === 1)?.visit_date;
    return !!firstVisit && firstVisit < returnWindowCutoff;
  }).length;
  const planCheck = Number(growthPlan?.current_avg_sale) || 0;
  const roiLedger = computeRoiLedger({
    returnedRegulars,
    atRiskFirstTimers,
    avgCheck: planCheck > 0 ? planCheck : DEFAULT_AVG_CHECK,
    visitsPerYear: DEFAULT_VISITS_PER_YEAR,
    usingDefaultCheck: !(planCheck > 0),
  });

  // Trends (period-over-period, independent of the range toggle above).
  const now = currentDate();
  const cohorts = monthlyRepeatCohorts(allGuests, now, 6);
  const maxCohortPct = Math.max(10, ...cohorts.map((c) => c.repeatPct));
  const trainingMonths = monthlyTrainingCompletion((signoffTrend ?? []) as { completion_pct: number; occurred_on: string | null }[], now, 6);
  // Pair training completion with the same months' repeat rate. Only worth
  // showing once there's real sign-off history to relate to retention.
  const trainingVsRetention = cohorts.map((c, i) => ({
    label: c.label,
    training: trainingMonths[i]?.avgCompletion ?? 0,
    trainingCount: trainingMonths[i]?.count ?? 0,
    repeat: c.repeatPct,
    newGuests: c.newGuests,
  }));
  const hasTrainingHistory = trainingMonths.some((m) => m.count > 0);

  // Menu profitability — classify each item into Star / Plowhorse / Puzzle / Dog.
  const menuRows: MenuItemRow[] = ((menuItems ?? []) as { id: string; name: string; price: number; food_cost: number; popularity: number }[]).map((r) => ({
    id: r.id,
    name: r.name,
    price: Number(r.price),
    food_cost: Number(r.food_cost),
    popularity: r.popularity,
  }));
  const menu = classifyMenu(menuRows);
  const menuOrder: Quadrant[] = ["star", "plowhorse", "puzzle", "dog"];
  const menuTakeaway =
    menu.counts.dog > 0
      ? `${menu.counts.dog} Dog${menu.counts.dog === 1 ? "" : "s"} dragging your margin — rework, re-cost, or cut.`
      : menu.counts.star > 0
        ? `${menu.counts.star} Star${menu.counts.star === 1 ? "" : "s"} to protect and feature — box them and put them in the sweet spots.`
        : "Add prices and popularity in Menu Engineering to see where your profit is.";

  // Per-staff spot-check scorecard (lowest average first = coaching priority).
  const staffScores = computeSpotCheckAverages((spotChecks ?? []) as SpotCheck[])
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 8);

  // Comp $ by server, with a simple outlier flag (well above the server average).
  const compByServerMap = new Map<string, number>();
  for (const d of (discounts ?? []) as { amount: number; server_name?: string | null }[]) {
    const name = (d.server_name || "").trim();
    if (!name) continue;
    compByServerMap.set(name, (compByServerMap.get(name) ?? 0) + Number(d.amount));
  }
  const compByServer = [...compByServerMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  const avgComp = compByServer.length > 0 ? compByServer.reduce((s, c) => s + c.total, 0) / compByServer.length : 0;
  const compOutlierFloor = Math.max(avgComp * 1.5, 1); // flag well-above-average compers

  // Audit health-score over time (oldest → newest for the trend).
  const auditTrend = [...((audits ?? []) as { occurred_on: string; health_score: number }[])].reverse();
  const maxHealth = 100;

  // Checklist compliance by month.
  const checklistMonths = monthlyChecklistCompliance((checklistRows ?? []) as ChecklistLite[], now, 6);
  const hasChecklistHistory = checklistMonths.some((m) => m.logs > 0);

  // Which visit-1 incentive best drives a return visit.
  const incentives = incentiveEffectiveness(allGuests as unknown as IncentiveGuest[]).slice(0, 6);

  // Compact snapshot for the AI briefing — just the numbers, no re-querying.
  const reportSnapshot = JSON.stringify({
    range: activeRange.rangeLabel,
    repeatRatePct: retentionPct,
    reactionRatio: reactionRatioLabel,
    recoverySpendUsd: Math.round(discountTotal),
    referralRatePct: referralRate,
    repeatRateByMonth: cohorts.map((c) => ({ month: c.label, repeatPct: c.repeatPct, newGuests: c.newGuests })),
    trainingByMonth: hasTrainingHistory ? trainingMonths.map((m) => ({ month: m.label, completionPct: m.avgCompletion })) : undefined,
    menu: menuRows.length > 0 ? menu.counts : undefined,
    lowestStaffScores: staffScores.slice(0, 3).map((s) => ({ name: s.name, avgOutOf5: Number(s.avg.toFixed(1)) })),
    topCompServers: compByServer.slice(0, 3).map((c) => ({ name: c.name, comps: Math.round(c.total) })),
    auditHealthTrend: auditTrend.length >= 2 ? auditTrend.map((a) => a.health_score) : undefined,
    checklistComplianceByMonth: hasChecklistHistory ? checklistMonths.map((m) => ({ month: m.label, pct: m.pct })) : undefined,
    bestIncentive: incentives[0] ? { offer: incentives[0].incentive, returnPct: incentives[0].returnPct, newGuests: incentives[0].newGuests } : undefined,
  });
  // Company-wide money-layer trend: collapse per-location weekly rows into one
  // company total per week (multi-location orgs store a row per location), then
  // show the most recent 12 weeks oldest→newest.
  const bizWeekly = aggregateBizHealthByWeek((bizHealth ?? []) as BizHealthRawRow[])
    .sort((a, b) => b.period_date.localeCompare(a.period_date))
    .slice(0, 12);
  const bizPoints = bizHealthTrend(bizWeekly);
  const bizMetrics =
    bizPoints.length >= 2
      ? (() => {
          const last = bizPoints[bizPoints.length - 1];
          const prev = bizPoints[bizPoints.length - 2];
          const delta = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10);
          return [
            { label: "Net sales", value: `$${Math.round(last.netSales).toLocaleString()}`, deltaPct: delta(last.netSales, prev.netSales), goodUp: true },
            { label: "Avg check", value: `$${last.avgCheck.toFixed(2)}`, deltaPct: delta(last.avgCheck, prev.avgCheck), goodUp: true },
            { label: "Labor %", value: `${last.laborPct}%`, deltaPct: delta(last.laborPct, prev.laborPct), goodUp: false },
            { label: "Comp %", value: `${last.compPct}%`, deltaPct: delta(last.compPct, prev.compPct), goodUp: false },
          ];
        })()
      : null;

  const growthTarget = growthPlan
    ? buildPhases(
        {
          customers: Number(growthPlan.current_customers),
          avgSale: Number(growthPlan.current_avg_sale),
          repurchaseFrequency: Number(growthPlan.current_repurchase_frequency),
        },
        10,
        Number(growthPlan.target_customers_pct),
        Number(growthPlan.target_avg_sale_pct),
        Number(growthPlan.target_frequency_pct)
      ).target
    : null;

  const byLocation = locations.map((loc) => {
    const locDiscounts = (discounts ?? []).filter((d) => d.location_id === loc.id);
    const locGuests = newGuestsInRange.filter((g) => g.guest_visits.find((v) => v.visit_number === 1)?.location_id === loc.id);
    const locReturned = locGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;
    const locSpotChecks = (spotChecks ?? []).filter((sc) => sc.location_id === loc.id);
    const locSpotCheckAvg = locSpotChecks.length
      ? locSpotChecks.reduce((s, sc) => s + sc.scores.reduce((a: number, b: number) => a + b, 0) / sc.scores.length, 0) / locSpotChecks.length
      : null;
    return {
      name: loc.name,
      discountTotal: locDiscounts.reduce((s, d) => s + Number(d.amount), 0),
      retentionPct: locGuests.length > 0 ? Math.round((locReturned / locGuests.length) * 100) : 0,
      newGuests: locGuests.length,
      spotCheckAvg: locSpotCheckAvg,
    };
  });

  const sections = [
    {
      icon: Heart,
      label: "Culture",
      href: "/culture",
      iconBg: "bg-[#FCE7F0]",
      iconFg: "text-[#BE185D]",
      rows: [{ label: "Culture moments", value: momentCount?.length ?? 0 }],
    },
    {
      icon: RotateCcw,
      label: "Guest Bounce Back",
      href: "/bounceback",
      iconBg: "bg-brick-tint",
      iconFg: "text-brick",
      rows: [
        { label: "New guests", value: newGuestsInRange.length },
        { label: "Won back", value: returnedCount },
        { label: "Referrals", value: referredCount },
      ],
    },
    {
      icon: Receipt,
      label: "Service Recovery",
      href: "/recovery",
      iconBg: "bg-[#FDF3E1]",
      iconFg: "text-[#B45309]",
      rows: [
        { label: "Comps logged", value: (discounts ?? []).length },
        { label: "Total spend", value: `$${discountTotal.toFixed(0)}` },
      ],
    },
    {
      icon: GraduationCap,
      label: "Training",
      href: "/training",
      iconBg: "bg-brick-tint",
      iconFg: "text-brick",
      rows: [{ label: "Standards signed off", value: (signoffs ?? []).length }],
    },
    {
      icon: AlertTriangle,
      label: "Accountability",
      href: "/accountability",
      iconBg: "bg-[#FDF3E1]",
      iconFg: "text-[#D97706]",
      rows: [
        { label: "Spot-checks", value: (spotChecks ?? []).length },
        { label: "Avg score", value: spotCheckAvg.toFixed(1) },
      ],
    },
    {
      icon: Briefcase,
      label: "Hiring",
      href: "/hiring",
      iconBg: "bg-[#E7F6EC]",
      iconFg: "text-[#15803D]",
      rows: [
        { label: "Candidates scored", value: (candidates ?? []).length },
        { label: "Strong fits", value: strongFitCount },
      ],
    },
    {
      icon: TrendingUp,
      label: "Revenue Growth Planner",
      href: "/growth",
      iconBg: "bg-brick-tint",
      iconFg: "text-brick",
      rows: growthTarget
        ? [
            { label: "Target growth", value: `+${growthTarget.pctIncreaseVsBase.toFixed(1)}%` },
            { label: "Target revenue", value: `$${growthTarget.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
          ]
        : [{ label: "Status", value: "Not set up yet" }],
    },
  ];

  return (
    <>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Reporting</h1>
          <p className="text-base text-muted">
            {effectiveLocation
              ? `${locations.find((l) => l.id === effectiveLocation)?.name ?? "Location"} — ${activeRange.rangeLabel}.`
              : `Every section, one view — ${activeRange.rangeLabel}.`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1 bg-white border border-line rounded-xl p-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/reporting?range=${r.key}${locationQs}`}
                className={`text-[13px] font-semibold px-3.5 py-2 rounded-[9px] transition-colors ${
                  activeRange.key === r.key ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
          {isSuperAdmin && <ScheduleReportModalButton />}
          <ExportCsvButton
            filename="wingman-report.csv"
            headers={["Section", "Metric", "Value"]}
            rows={sections.flatMap((s) => s.rows.map((r) => [s.label, r.label, r.value]))}
            label="Export report"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Repeat rate" value={`${retentionPct}%`} sub="guests back for visit 2" />
        <StatTile label="Reaction ratio" value={reactionRatioLabel} sub="positive to flat" />
        <StatTile label="Recovery spend" value={`$${discountTotal.toFixed(0)}`} sub="all reasons tagged" />
        <StatTile label="Referral rate" value={`${referralRate}%`} sub="raving-fan index" />
      </div>

      <ReportNarrative snapshot={reportSnapshot} />

      <RoiLedgerCard roi={roiLedger} />

      {/* Trends — the story over time, not just a single window. */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Repeat rate by cohort</span>
          <span className="text-[13px] text-muted">last 6 months</span>
        </div>
        <p className="text-[13px] text-muted mb-5">Of each month&rsquo;s first-timers, how many came back for a 2nd visit — the truest read on whether you&rsquo;re turning guests into regulars.</p>
        <div className="flex items-end gap-3 sm:gap-5 h-44">
          {cohorts.map((c) => (
            <div key={c.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="text-[12px] font-semibold text-ink tabular-nums">{c.newGuests > 0 ? `${c.repeatPct}%` : "—"}</div>
              <div className="w-full max-w-[56px] bg-paper rounded-t-md flex items-end" style={{ height: "100%" }}>
                <div
                  className={`w-full rounded-t-md ${c.repeatPct >= 50 ? "bg-olive" : c.repeatPct >= 30 ? "bg-brick" : "bg-brick/50"}`}
                  style={{ height: `${c.newGuests > 0 ? Math.max(4, Math.round((c.repeatPct / maxCohortPct) * 100)) : 0}%` }}
                />
              </div>
              <div className="text-[11.5px] font-medium text-charcoal-2">{c.label}</div>
              <div className="text-[10.5px] text-muted-2 tabular-nums">{c.newGuests} new</div>
            </div>
          ))}
        </div>
      </div>

      {incentives.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">What brings them back</span>
            <span className="text-[13px] text-muted">by visit-1 offer</span>
          </div>
          <p className="text-[13px] text-muted mb-4">The return rate of first-timers grouped by the incentive they were given — so you spend on the offers that actually earn a second visit, not the ones that just cost you.</p>
          <div className="flex flex-col gap-2.5">
            {incentives.map((inc) => (
              <div key={inc.incentive} className="flex items-center gap-3 text-[13.5px]">
                <span className="w-40 shrink-0 text-ink truncate">{inc.incentive}</span>
                <span className="flex-1 h-2 rounded-full bg-paper overflow-hidden">
                  <span className={`block h-full ${inc.returnPct >= 50 ? "bg-olive" : inc.returnPct >= 30 ? "bg-brick" : "bg-brick/50"}`} style={{ width: `${inc.returnPct}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums font-semibold text-ink">{inc.returnPct}%</span>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted-2">{inc.newGuests} used</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasTrainingHistory && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Training vs. retention</span>
            <span className="text-[13px] text-muted">last 6 months</span>
          </div>
          <p className="text-[13px] text-muted mb-4">A team held to standard brings more guests back. Watch these two move together — when training climbs, so should repeat rate.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em]">Month</th>
                  <th className="pb-2 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em]">Team training</th>
                  <th className="pb-2 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em]">Repeat rate</th>
                </tr>
              </thead>
              <tbody>
                {trainingVsRetention.map((r) => (
                  <tr key={r.label} className="border-t border-[#F5F5F5]">
                    <td className="py-2.5 font-medium text-ink">{r.label}</td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-24 h-1.5 rounded-full bg-paper overflow-hidden">
                          <span className="block h-full bg-olive" style={{ width: `${r.training}%` }} />
                        </span>
                        <span className="text-charcoal-2 tabular-nums text-[13px]">{r.trainingCount > 0 ? `${r.training}%` : "—"}</span>
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-24 h-1.5 rounded-full bg-paper overflow-hidden">
                          <span className="block h-full bg-brick" style={{ width: `${r.repeat}%` }} />
                        </span>
                        <span className="text-charcoal-2 tabular-nums text-[13px]">{r.newGuests > 0 ? `${r.repeat}%` : "—"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bizMetrics && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">The money layer</span>
            <span className="text-[13px] text-muted">latest week vs. prior</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {bizMetrics.map((m) => {
              const up = m.deltaPct != null && m.deltaPct > 0;
              const down = m.deltaPct != null && m.deltaPct < 0;
              const good = m.deltaPct == null || m.deltaPct === 0 ? "text-muted-2" : (up === m.goodUp ? "text-olive" : "text-brick");
              return (
                <div key={m.label}>
                  <div className="text-[13px] text-muted mb-1">{m.label}</div>
                  <div className="text-[24px] font-bold tracking-[-0.01em] text-ink tabular-nums">{m.value}</div>
                  <div className={`text-[12.5px] font-semibold ${good}`}>
                    {m.deltaPct == null ? "—" : `${up ? "▲" : down ? "▼" : ""} ${Math.abs(m.deltaPct)}% wk/wk`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(auditTrend.length >= 2 || hasChecklistHistory) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {auditTrend.length >= 2 && (
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Health score over time</span>
                <span className="text-[13px] text-muted">last {auditTrend.length} audits</span>
              </div>
              <p className="text-[13px] text-muted mb-5">Your Standout Audit score, audit to audit — is the operation actually getting stronger?</p>
              <div className="flex items-end gap-3 h-32">
                {auditTrend.map((a, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="text-[12px] font-semibold text-ink tabular-nums">{a.health_score}</div>
                    <div className="w-full max-w-[48px] bg-paper rounded-t-md flex items-end" style={{ height: "100%" }}>
                      <div className={`w-full rounded-t-md ${a.health_score >= 70 ? "bg-olive" : a.health_score >= 45 ? "bg-brick" : "bg-brick/50"}`} style={{ height: `${Math.max(4, Math.round((a.health_score / maxHealth) * 100))}%` }} />
                    </div>
                    <div className="text-[10.5px] text-muted-2">{new Date(a.occurred_on).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasChecklistHistory && (
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Checklist compliance</span>
                <span className="text-[13px] text-muted">last 6 months</span>
              </div>
              <p className="text-[13px] text-muted mb-5">Share of shift-checklist items actually completed — is the team running the checks, or just clocking in?</p>
              <div className="flex items-end gap-3 h-32">
                {checklistMonths.map((m) => (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="text-[12px] font-semibold text-ink tabular-nums">{m.logs > 0 ? `${m.pct}%` : "—"}</div>
                    <div className="w-full max-w-[48px] bg-paper rounded-t-md flex items-end" style={{ height: "100%" }}>
                      <div className={`w-full rounded-t-md ${m.pct >= 80 ? "bg-olive" : m.pct >= 50 ? "bg-brick" : "bg-brick/50"}`} style={{ height: `${m.logs > 0 ? Math.max(4, m.pct) : 0}%` }} />
                    </div>
                    <div className="text-[11.5px] font-medium text-charcoal-2">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(staffScores.length > 0 || compByServer.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {staffScores.length > 0 && (
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Staff scorecard</span>
                <span className="text-[13px] text-muted">{activeRange.rangeLabel}</span>
              </div>
              <p className="text-[13px] text-muted mb-4">Average spot-check score per person — lowest first, so coaching goes where it&rsquo;s needed.</p>
              <div className="flex flex-col gap-2.5">
                {staffScores.map((s) => {
                  const pct = Math.round((s.avg / 5) * 100);
                  const tone = s.avg >= 4 ? "bg-olive" : s.avg >= 3 ? "bg-[#D97706]" : "bg-brick";
                  return (
                    <div key={s.name} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[13.5px] text-ink truncate">{s.name}</span>
                      <span className="flex-1 h-2 rounded-full bg-paper overflow-hidden">
                        <span className={`block h-full ${tone}`} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-charcoal-2">{s.avg.toFixed(1)}/5</span>
                      <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-muted-2">{s.count} chk</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {compByServer.length > 0 && (
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Comps by server</span>
                <span className="text-[13px] text-muted">{activeRange.rangeLabel}</span>
              </div>
              <p className="text-[13px] text-muted mb-4">Who&rsquo;s giving away the most — outliers (well above average) are flagged for a conversation.</p>
              <div className="flex flex-col gap-2">
                {compByServer.slice(0, 8).map((c) => {
                  const outlier = compByServer.length > 1 && c.total >= compOutlierFloor;
                  return (
                    <div key={c.name} className="flex items-center justify-between gap-3 text-[13.5px]">
                      <span className="text-ink truncate flex items-center gap-2">
                        {c.name}
                        {outlier && <span className="text-[11px] font-semibold text-brick bg-brick-tint px-2 py-0.5 rounded-full">high</span>}
                      </span>
                      <span className="font-semibold tabular-nums text-ink">${c.total.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {menuRows.length > 0 && (
        <Link href="/menu-engineering">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Menu profitability</span>
              <span className="text-[13px] text-muted">{menuRows.length} items</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {menuOrder.map((q) => (
                <div key={q} className="rounded-xl border border-[#F1F1F1] p-3.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${QUADRANT_META[q].dot}`} />
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wide">{QUADRANT_META[q].label}s</span>
                  </div>
                  <div className="text-[24px] font-bold tabular-nums text-ink">{menu.counts[q]}</div>
                </div>
              ))}
            </div>
            <p className="text-[13.5px] text-charcoal-2">{menuTakeaway}</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow h-full">
              <div className="flex items-center gap-2.5 mb-[18px]">
                <span className={`w-[34px] h-[34px] rounded-[10px] ${s.iconBg} ${s.iconFg} flex items-center justify-center`}>
                  <s.icon size={16} />
                </span>
                <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{s.label}</span>
              </div>
              <div className="flex flex-col gap-3">
                {s.rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] text-muted">{row.label}</span>
                    <span className="text-[15px] font-semibold tabular-nums text-ink">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {isSuperAdmin && locations.length > 1 && !effectiveLocation && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">By location</span>
            <span className="text-[13px] font-semibold text-muted">{activeRange.rangeLabel}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] text-left">
                {["Location", "New guests", "Repeat rate", "Recovery spend", "Accountability"].map((h) => (
                  <th key={h} className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byLocation.map((l) => (
                <tr key={l.name} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-6 py-3.5 font-medium text-ink border-b border-[#F5F5F5]">{l.name}</td>
                  <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5] tabular-nums">{l.newGuests}</td>
                  <td className="px-6 py-3.5 text-ink border-b border-[#F5F5F5] tabular-nums">{l.retentionPct}%</td>
                  <td className="px-6 py-3.5 text-ink font-semibold border-b border-[#F5F5F5] tabular-nums">${l.discountTotal.toFixed(0)}</td>
                  <td className="px-6 py-3.5 text-ink border-b border-[#F5F5F5] tabular-nums">
                    {l.spotCheckAvg !== null ? `${l.spotCheckAvg.toFixed(1)}/5` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-[18px]">
            <div>
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Scheduled reports</span>
              <div className="text-[13px] text-muted mt-0.5">Delivered to Managers and Super Admins by email.</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {(schedules ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-3.5 p-4 border border-[#EDEDED] rounded-xl">
                <span className="w-9 h-9 rounded-[10px] bg-brick-tint text-brick flex items-center justify-center text-[15px] shrink-0">🗓</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-ink capitalize">{s.frequency}</span>
                  <span className="text-xs text-muted ml-2">{s.sections.join(", ")}</span>
                  {s.recipient_emails.length > 0 && (
                    <div className="text-xs text-muted mt-0.5">To: {s.recipient_emails.join(", ")}</div>
                  )}
                </div>
                <form action={deleteReportSchedule.bind(null, s.id)}>
                  <button type="submit" className="text-muted-2 hover:text-danger text-xs font-semibold shrink-0">
                    Remove
                  </button>
                </form>
              </div>
            ))}
            {(schedules ?? []).length === 0 && <p className="text-sm text-muted">No scheduled reports yet.</p>}
          </div>
        </div>
      )}
    </>
  );
}
