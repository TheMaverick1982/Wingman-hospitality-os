import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import {
  aggregateBy,
  computeSpotCheckAverages,
  computeStageCounts,
  stageOf,
  type Discount,
  type GuestWithVisits,
  type SpotCheck,
} from "@/lib/hospitality";
import { computeCoachingFlags } from "@/lib/coaching-flags";
import { Stat } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { RetentionChart } from "@/components/dashboard/retention-chart";
import {
  RotateCcw,
  Receipt,
  ClipboardCheck,
  Heart,
  AlertTriangle,
  Flame,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  Quote,
  Lock,
} from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();

  const [
    { data: org },
    { data: guests },
    discountsQuery,
    spotChecksQuery,
    dailyChecksQuery,
    { count: trainingSignoffCount },
    { count: cultureMomentCount },
    locations,
  ] = await Promise.all([
    supabase.from("organizations").select("total_revenue, weekly_focus").single(),
    supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
    scoped(supabase.from("discounts").select("*"), effectiveLocation),
    scoped(supabase.from("spot_checks").select("id, staff_name, scores"), effectiveLocation),
    scoped(supabase.from("daily_checklists").select("*").order("occurred_on", { ascending: false }).limit(1), effectiveLocation),
    supabase.from("training_signoffs").select("id", { count: "exact", head: true }),
    supabase.from("culture_moments").select("id", { count: "exact", head: true }),
    getOrgLocations(),
  ]);

  const discounts = (discountsQuery.data ?? []) as Discount[];
  const spotChecks = (spotChecksQuery.data ?? []) as SpotCheck[];
  const lastDailyCheck = (dailyChecksQuery.data ?? [])[0] as { checked: boolean[] } | undefined;
  const allGuests = (guests ?? []) as GuestWithVisits[];
  const stageCounts = computeStageCounts(allGuests);
  const guestsAwaitingFollowUp = allGuests.filter(
    (g) => stageOf(g.guest_visits) === 1
  ).length;

  // Attribute each guest to the location of their first visit, then check
  // whether they came back (anywhere) - this is the per-location "did this
  // location create a repeat guest" benchmark, independent of where the
  // return visit happened (Guest Bounce Back is cross-location by design).
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
  const totalRevenue = Number(org?.total_revenue ?? 0);
  const discountPct = totalRevenue > 0 ? ((discountTotal / totalRevenue) * 100).toFixed(1) : "0.0";
  const byCategory = aggregateBy(discounts, (d) => d.category, (d) => Number(d.amount));
  const staffAverages = computeSpotCheckAverages(spotChecks);

  const flags = computeCoachingFlags({
    discountPct,
    byCategory,
    guestsAwaitingFollowUp,
    staffAverages,
    lastDailyCheck,
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Good morning.</h1>
      <p className="text-sm text-muted mb-6">
        Here&apos;s where the guest experience stands across {effectiveLocation ? "this location" : "every location"}.
      </p>

      <div className="flex flex-wrap gap-4 mb-6">
        <Stat
          label="Bounce-back – 2nd visit"
          value={`${stageCounts.pct[1] || 0}%`}
          sub={`${stageCounts.counts[1] || 0} of ${stageCounts.total} guests returned`}
          tone="brick"
          icon={RotateCcw}
        />
        <Stat
          label="Discount rate"
          value={`${discountPct}%`}
          sub="Target: 3–4% of revenue"
          tone={Number(discountPct) > 4 ? "danger" : "olive"}
          icon={Number(discountPct) > 4 ? TrendingUp : TrendingDown}
        />
        <Stat label="Training sign-offs" value={trainingSignoffCount ?? 0} sub="Logged this period" tone="gold" icon={ClipboardCheck} />
        <Stat label="Culture moments" value={cultureMomentCount ?? 0} sub="Recognized this period" tone="olive" icon={Heart} />
      </div>

      {flags.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-brick" />
            <h3 className="font-display text-lg font-semibold text-ink">Needs attention</h3>
          </div>
          <div className="flex flex-col gap-2">
            {flags.map((f, i) => (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${f.tone === "danger" ? "bg-danger-tint" : "bg-gold-tint"}`}>
                <span className={`text-sm ${f.tone === "danger" ? "text-danger" : "text-[#b45309]"}`}>{f.text}</span>
              </div>
            ))}
          </div>
          <Link href="/accountability" className="text-brick text-xs font-semibold flex items-center gap-1 mt-3">
            Open Accountability <ArrowUpRight size={12} />
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-5 mb-5">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={16} className="text-brick" />
            <h3 className="font-display text-lg font-semibold text-ink">This week&apos;s focus</h3>
          </div>
          <p className="text-sm leading-relaxed mb-3 text-charcoal-2">{org?.weekly_focus || "Nothing set yet."}</p>
          <Link href="/culture" className="text-brick text-xs font-semibold flex items-center gap-1">
            Update in Culture <ArrowUpRight size={12} />
          </Link>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={16} className="text-brick" />
            <h3 className="font-display text-lg font-semibold text-ink">Top discount driver</h3>
          </div>
          {byCategory[0] ? (
            <>
              <p className="text-sm mb-1 text-charcoal-2">
                <b>{byCategory[0][0]}</b> — {byCategory[0][1].count} incidents, ${byCategory[0][1].total} total
              </p>
              <p className="text-xs text-muted">Coach this specifically at pre-shift this week.</p>
            </>
          ) : (
            <p className="text-sm text-muted">No discounts logged yet.</p>
          )}
          <Link href="/recovery" className="text-brick text-xs font-semibold flex items-center gap-1 mt-3">
            View full breakdown <ArrowUpRight size={12} />
          </Link>
        </Card>
      </div>

      <div className={`grid ${!effectiveLocation && locationBenchmarks.length > 1 ? "grid-cols-[1fr_320px]" : "grid-cols-1"} gap-5 mb-5`}>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-lg font-semibold text-ink">Guest retention by visit</h3>
            <span className="text-xs text-muted">Cumulative · all time</span>
          </div>
          <p className="text-xs text-muted mb-2">How many guests have reached each return visit, out of {stageCounts.total} tracked.</p>
          <RetentionChart counts={stageCounts.counts} labels={["Visit 1", "Visit 2", "Visit 3", "Visit 4"]} />
        </Card>

        {!effectiveLocation && locationBenchmarks.length > 1 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-ink">Locations</h3>
              <span className="text-xs text-muted">repeat rate</span>
            </div>
            <div className="flex flex-col gap-3">
              {locationBenchmarks.map((l) => (
                <div key={l.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-charcoal-2">{l.name}</span>
                    <span className="font-mono font-semibold text-ink">{l.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full ${l.pct >= groupAveragePct ? "bg-brick" : "bg-gold"}`}
                      style={{ width: `${l.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-4 pt-4 border-t border-line">
              Group average <span className="font-semibold text-ink">{groupAveragePct}%</span>
            </p>
          </Card>
        )}
      </div>

      <Card className="p-6 mb-5 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-muted-2" />
          <h3 className="font-display text-lg font-semibold text-ink">Business health</h3>
        </div>
        <p className="text-xs text-muted mb-5">
          Revenue per seat, labor %, and comp cost against sales — unlocks once Wingman is connected
          to your POS.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {["Revenue / seat", "Revenue / labor hr", "Comp cost", "Retention $ impact", "Avg check", "Labor %"].map((label) => (
            <div key={label} className="opacity-40">
              <div className="text-xs text-muted mb-1">{label}</div>
              <div className="font-mono text-xl font-semibold text-ink">—</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-charcoal rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Quote size={22} className="text-gold" />
          <p className="text-[#f5f5f5] font-display text-lg leading-snug">
            We can send all the customers we want to a restaurant — if they don&apos;t come back, that&apos;s not good.
            Everything here exists to move guests from Visit 1 to Visit 4.
          </p>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(query: any, effectiveLocation: string | null) {
  return effectiveLocation ? query.eq("location_id", effectiveLocation) : query;
}
