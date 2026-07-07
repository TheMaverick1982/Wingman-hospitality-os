import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { aggregateBy, computeSpotCheckAverages, stageOf, type Discount, type SpotCheck } from "@/lib/hospitality";
import { computeCoachingFlags } from "@/lib/coaching-flags";
import { canEditSection } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { AlertTriangle, CheckCircle2, Sunrise, Sparkle } from "lucide-react";
import { DailyCheckModalButton } from "./daily-check-modal";
import { SpotCheckModalButton } from "./spot-check-modal";
import { PreShiftCheckModalButton } from "./pre-shift-check-modal";
import { AmbianceCheckModalButton } from "./ambiance-check-modal";
import { CoachingModalButton } from "./coaching-modal";
import { SPOT_CHECK_DIMENSIONS } from "@/lib/constants";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function AccountabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isSuperAdmin = profile.accessRole === "super_admin";
  const canEdit = canEditSection(profile.accessRole, "accountability");

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();

  let discountsQ = supabase.from("discounts").select("*");
  let spotChecksQ = supabase.from("spot_checks").select("*").order("occurred_on", { ascending: false });
  let dailyChecksQ = supabase.from("daily_checklists").select("*").order("occurred_on", { ascending: false });
  let preShiftChecksQ = supabase.from("pre_shift_checks").select("*").order("occurred_on", { ascending: false }).limit(8);
  let ambianceChecksQ = supabase.from("ambiance_checks").select("*").order("occurred_on", { ascending: false }).limit(5);
  let coachingLogsQ = supabase.from("coaching_logs").select("*").order("created_at", { ascending: false }).limit(8);
  if (effectiveLocation) {
    discountsQ = discountsQ.eq("location_id", effectiveLocation);
    spotChecksQ = spotChecksQ.eq("location_id", effectiveLocation);
    dailyChecksQ = dailyChecksQ.eq("location_id", effectiveLocation);
    preShiftChecksQ = preShiftChecksQ.eq("location_id", effectiveLocation);
    ambianceChecksQ = ambianceChecksQ.eq("location_id", effectiveLocation);
    coachingLogsQ = coachingLogsQ.eq("location_id", effectiveLocation);
  }

  const [
    { data: discountsData },
    { data: spotChecksData },
    { data: dailyChecksData },
    { data: preShiftChecksData },
    { data: ambianceChecksData },
    { data: coachingLogsData },
    { data: guests },
    locations,
  ] = await Promise.all([
    discountsQ,
    spotChecksQ,
    dailyChecksQ,
    preShiftChecksQ,
    ambianceChecksQ,
    coachingLogsQ,
    supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
    getOrgLocations(),
  ]);

  const discounts = (discountsData ?? []) as Discount[];
  const spotChecks = (spotChecksData ?? []) as (SpotCheck & { id: string; department: string; occurred_on: string; felt_like_transaction: boolean; notes: string })[];
  const dailyChecks = dailyChecksData ?? [];
  const preShiftChecks = preShiftChecksData ?? [];
  const ambianceChecks = ambianceChecksData ?? [];
  const coachingLogs = coachingLogsData ?? [];

  const { data: org } = await supabase.from("organizations").select("total_revenue").single();
  const discountTotal = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const revenue = Number(org?.total_revenue ?? 0);
  const discountPct = revenue > 0 ? ((discountTotal / revenue) * 100).toFixed(1) : "0.0";
  const byCategory = aggregateBy(discounts, (d) => d.category, (d) => Number(d.amount));
  const guestsAwaitingFollowUp = (guests ?? []).filter((g) => stageOf(g.guest_visits) === 1).length;
  const staffAverages = computeSpotCheckAverages(spotChecks);
  const flags = computeCoachingFlags({
    discountPct,
    byCategory,
    guestsAwaitingFollowUp,
    staffAverages,
    lastDailyCheck: dailyChecks[0],
  });

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const sevenDaysAgo = daysAgoIso(7);
  const spotChecksThisWeek = spotChecks.filter((sc) => sc.occurred_on >= sevenDaysAgo);
  const flaggedThisWeek = spotChecksThisWeek.filter((sc) => {
    const avg = sc.scores.reduce((a, b) => a + b, 0) / sc.scores.length;
    return sc.felt_like_transaction || avg < 3.5;
  });

  const pctComplete = (items: { checked: boolean[] }[]) =>
    items.length > 0
      ? Math.round((items.reduce((s, i) => s + i.checked.filter(Boolean).length / i.checked.length, 0) / items.length) * 100)
      : null;
  const dailyPct = pctComplete(dailyChecks);
  const preShiftPct = pctComplete(preShiftChecks);
  const ambiancePct =
    ambianceChecks.length > 0
      ? Math.round(
          (ambianceChecks.reduce((s, a) => s + a.scores.reduce((x: number, y: number) => x + y, 0) / a.scores.length / 5, 0) /
            ambianceChecks.length) *
            100
        )
      : null;
  const spotCheckPct =
    staffAverages.length > 0 ? Math.round((staffAverages.reduce((s, a) => s + a.avg, 0) / staffAverages.length / 5) * 100) : null;
  const components = [dailyPct, preShiftPct, ambiancePct, spotCheckPct].filter((v): v is number => v !== null);
  const accountabilityScore = components.length > 0 ? Math.round(components.reduce((a, b) => a + b, 0) / components.length) : 0;

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Catch drift before it sets in</h1>
          <p className="text-base text-muted max-w-xl">
            Spot-checks, coaching flags, and daily checklists that keep the standard honest.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {!canEdit && <Pill>View only</Pill>}
          {canEdit && (
            <>
              <DailyCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
              />
              <SpotCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
              />
              <PreShiftCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
              />
              <AmbianceCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Accountability score" value={accountabilityScore} sub="weighted across checks logged" />
        <StatTile label="Spot-checks this week" value={spotChecksThisWeek.length} sub={`${flaggedThisWeek.length} flagged`} />
        <StatTile
          label="Open coaching flags"
          value={flags.length}
          sub="needing a conversation"
          trend={flags.length > 0 ? "Act" : undefined}
          trendTone="down"
        />
        <StatTile label="Checklist completion" value={dailyPct !== null ? `${dailyPct}%` : "—"} sub="opening & closing" />
      </div>

      {flags.length > 0 ? (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-brick" />
              <h3 className="font-display text-lg font-semibold text-ink">Open coaching flags</h3>
            </div>
            <span className="text-xs font-bold text-danger bg-danger-tint px-2.5 py-0.5 rounded-full">{flags.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {flags.map((f, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-2 p-3 rounded-lg ${f.tone === "danger" ? "bg-danger-tint" : "bg-gold-tint"}`}
              >
                <span className={`text-sm ${f.tone === "danger" ? "text-danger" : "text-[#b45309]"}`}>{f.text}</span>
                {canEdit && (
                  <CoachingModalButton
                    flagText={f.text}
                    locations={locations}
                    isGm={isSuperAdmin}
                    lockedLocationName={profile.locationName}
                    defaultLocationId={effectiveLocation ?? profile.locationId}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="bg-olive-tint rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-[#15803d]" />
          <span className="text-sm font-medium text-[#15803d]">Nothing flagged right now — standards are holding.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-1 text-ink">Manager daily checklist</h3>
          <p className="text-xs mb-4 text-muted">The floor-level accountability standard, logged once per shift.</p>
          <div className="flex flex-col gap-2">
            {dailyChecks.slice(0, 5).map((dc) => {
              const doneCount = dc.checked.filter(Boolean).length;
              return (
                <div key={dc.id} className="flex items-center justify-between py-2.5 text-sm border-b border-line">
                  <div>
                    <span className="font-semibold text-ink">{dc.manager_name}</span>
                    <span className="text-muted"> — {locationName(dc.location_id)} · {dc.occurred_on}</span>
                  </div>
                  <Pill dot tone={doneCount === dc.checked.length ? "olive" : "gold"}>
                    {doneCount}/{dc.checked.length}
                  </Pill>
                </div>
              );
            })}
            {dailyChecks.length === 0 && <p className="text-sm text-muted">No checklists logged yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-1 text-ink">Spot-check averages</h3>
          <p className="text-xs mb-4 text-muted">Average score across all logged observations, per staff member.</p>
          <div className="flex flex-col gap-2.5">
            {staffAverages.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-2">{s.name}</span>
                <span className={`font-mono font-semibold ${s.avg < 3.5 ? "text-brick" : "text-olive"}`}>{s.avg.toFixed(1)} / 5</span>
              </div>
            ))}
            {staffAverages.length === 0 && <p className="text-sm text-muted">No spot-checks logged yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sunrise size={16} className="text-brick" />
            <h3 className="font-display text-lg font-semibold text-ink">Pre-shift checks</h3>
          </div>
          <p className="text-xs mb-4 text-muted">Readiness, logged per person before the shift.</p>
          <div className="flex flex-col gap-2">
            {preShiftChecks.slice(0, 5).map((pc) => {
              const doneCount = pc.checked.filter(Boolean).length;
              return (
                <div key={pc.id} className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-2">{pc.staff_name}</span>
                  <Pill dot tone={doneCount === pc.checked.length ? "olive" : "gold"}>
                    {doneCount}/{pc.checked.length}
                  </Pill>
                </div>
              );
            })}
            {preShiftChecks.length === 0 && <p className="text-sm text-muted">None logged yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkle size={16} className="text-brick" />
            <h3 className="font-display text-lg font-semibold text-ink">Ambiance checks</h3>
          </div>
          <p className="text-xs mb-4 text-muted">First-impression score of the physical space.</p>
          <div className="flex flex-col gap-2">
            {ambianceChecks.slice(0, 5).map((ac) => {
              const avg = ac.scores.reduce((a: number, b: number) => a + b, 0) / ac.scores.length;
              return (
                <div key={ac.id} className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-2">{locationName(ac.location_id)} · {ac.occurred_on}</span>
                  <Pill dot tone={avg >= 4 ? "olive" : avg >= 3 ? "gold" : "danger"}>{avg.toFixed(1)}/5</Pill>
                </div>
              );
            })}
            {ambianceChecks.length === 0 && <p className="text-sm text-muted">None logged yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-1 text-ink">Coaching log</h3>
          <p className="text-xs mb-4 text-muted">State → Story → Strategy conversations, on record.</p>
          <div className="flex flex-col gap-2.5">
            {coachingLogs.slice(0, 4).map((cl) => (
              <div key={cl.id} className="text-sm">
                <p className="text-charcoal-2 leading-snug">{cl.flag_text}</p>
                {cl.strategy_note && <p className="text-xs text-muted mt-0.5">→ {cl.strategy_note}</p>}
              </div>
            ))}
            {coachingLogs.length === 0 && <p className="text-sm text-muted">None logged yet.</p>}
          </div>
        </Card>
      </div>

      <h3 className="font-display text-lg font-semibold mb-3 text-ink">Spot-check log</h3>
      <div className="flex flex-col gap-3">
        {spotChecks.map((sc) => {
          const avg = sc.scores.reduce((a, b) => a + b, 0) / sc.scores.length;
          return (
            <Card key={sc.id} className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{sc.staff_name}</span>
                  <Pill>{sc.department}</Pill>
                  <Pill dot tone={avg >= 4 ? "olive" : avg >= 3 ? "gold" : "danger"}>{avg.toFixed(1)}/5</Pill>
                </div>
                <span className="text-xs text-muted">{sc.occurred_on}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {SPOT_CHECK_DIMENSIONS.map((d, i) => (
                  <div key={d} className="text-center">
                    <div className="text-xs mb-1 leading-tight text-muted">{d}</div>
                    <div className="font-mono text-lg font-semibold text-ink">{sc.scores[i]}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-1 text-charcoal-2">{sc.notes}</p>
              <p className={`text-xs font-semibold ${sc.felt_like_transaction ? "text-brick" : "text-olive"}`}>
                {sc.felt_like_transaction ? "Felt like a transaction — run it again" : "Felt like an experience"}
              </p>
            </Card>
          );
        })}
        {spotChecks.length === 0 && <p className="text-sm text-muted">No spot-checks logged yet.</p>}
      </div>
    </>
  );
}
