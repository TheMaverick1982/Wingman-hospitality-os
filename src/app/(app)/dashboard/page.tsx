import Link from "next/link";
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
import { FIVE_GAPS, constraintGapIndex, scoreTone } from "@/lib/audit";
import { RetentionChart } from "@/components/dashboard/retention-chart";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { StatusPill } from "@/components/ui/status-pill";
import { ArrowUpRight, ClipboardCheck, Rocket, Sparkle } from "lucide-react";

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
    supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
    scoped(supabase.from("discounts").select("*"), effectiveLocation),
    scoped(supabase.from("spot_checks").select("id, staff_name, scores, created_at"), effectiveLocation),
    scoped(supabase.from("daily_checklists").select("*").order("occurred_on", { ascending: false }).limit(1), effectiveLocation),
    supabase
      .from("training_signoffs")
      .select("id, staff_name, department, completion_pct, occurred_on, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("training_signoffs").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(SEVEN_DAYS_MS)),
    supabase.from("culture_moments").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(NINETY_DAYS_MS)),
    supabase.from("culture_moments").select("id, author, about, created_at").order("created_at", { ascending: false }).limit(4),
    scoped(supabase.from("coaching_logs").select("id, flag_text, created_at").order("created_at", { ascending: false }).limit(4), effectiveLocation),
    getOrgLocations(),
    supabase.from("organizations").select("weekly_focus").single(),
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
  const stageCounts = computeStageCounts(allGuests);
  const guestsAwaitingFollowUp = allGuests.filter((g) => stageOf(g.guest_visits) === 1).length;
  const returningGuestCount = allGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;

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

  const discountTotal = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const byCategory = aggregateBy(discounts, (d) => d.category, (d) => Number(d.amount));
  const discountPct = discounts.length > 0 && discountTotal > 0 ? "4.0" : "0.0";
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

  const firstName = profile.fullName.split(" ")[0] || "there";
  const greetingLocation = effectiveLocation
    ? locations.find((l) => l.id === effectiveLocation)?.name ?? "your location"
    : "every location";
  return (
    <>
      <GreetingHeader firstName={firstName} greetingLocation={greetingLocation} />

      {onboarding && !onboarding.allDone && (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-line rounded-2xl p-[22px] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-muted font-medium">Repeat rate</span>
          </div>
          <div className="text-[38px] font-semibold tracking-[-0.02em] leading-none text-ink">
            {stageCounts.pct[1] || 0}%
          </div>
          <div className="text-[13px] text-muted mt-2.5">back for visit 2</div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-[22px] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-muted font-medium">Spot-checks logged</span>
          </div>
          <div className="text-[38px] font-semibold tracking-[-0.02em] leading-none text-ink">{spotChecks.length}</div>
          <div className="text-[13px] text-muted mt-2.5">across all departments</div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-[22px] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-muted font-medium">Sign-offs this week</span>
          </div>
          <div className="text-[38px] font-semibold tracking-[-0.02em] leading-none text-ink">{signoffsThisWeek ?? 0}</div>
          <div className="text-[13px] text-muted mt-2.5">logged in the last 7 days</div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-[22px] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-muted font-medium">Culture moments</span>
          </div>
          <div className="text-[38px] font-semibold tracking-[-0.02em] leading-none text-ink">{cultureMomentsThisQtr ?? 0}</div>
          <div className="text-[13px] text-muted mt-2.5">recognized this quarter</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
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
