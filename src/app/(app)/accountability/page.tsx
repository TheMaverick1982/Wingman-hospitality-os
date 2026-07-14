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
import { SPOT_CHECK_DIMENSIONS, FOH_DEPARTMENTS, ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { ChecklistTemplateEditor } from "./checklist-template-editor";
import { ChecklistRolesBar } from "./checklist-roles-bar";
import { CustomChecklistsManager } from "./custom-checklists-manager";
import { PrintChecklistsButton } from "./print-checklists-button";
import { getChecklistItems } from "./template-actions";
import { translateTexts } from "@/lib/translate";
import { MyChecklistsHub, type HubChecklist } from "./my-checklists-hub";
import { t as tr } from "@/lib/i18n";
import { PreshiftReport, type TodayCompletion, type RosterRow } from "./preshift-report";
// (per-checklist staff cards were consolidated into MyChecklistsHub)

// Build the "who completed today / last 30 days" view for a personal checklist
// from actual completions (shared by pre-shift and FOH loyalty).
type CompRow = { profile_id: string; occurred_on: string; completed_count: number; item_count: number; updated_at: string | null; created_at: string };
function buildChecklistReport(comps: CompRow[], todayStr: string, nameById: Map<string, string>, rosterProfiles: { id: string; full_name: string }[]): { today: TodayCompletion[]; roster: RosterRow[] } {
  const today: TodayCompletion[] = comps
    .filter((c) => c.occurred_on === todayStr)
    .map((c) => ({ name: nameById.get(c.profile_id) ?? "Team member", completedCount: c.completed_count, itemCount: c.item_count, completedAt: c.updated_at ?? c.created_at }));

  const byProfile = new Map<string, { count: number; last: string | null }>();
  for (const c of comps) {
    const cur = byProfile.get(c.profile_id) ?? { count: 0, last: null };
    cur.count += 1;
    if (!cur.last || c.occurred_on > cur.last) cur.last = c.occurred_on;
    byProfile.set(c.profile_id, cur);
  }
  const roster: RosterRow[] = rosterProfiles
    .map((p) => {
      const agg = byProfile.get(p.id);
      return { name: p.full_name, lastCompleted: agg?.last ?? null, count30d: agg?.count ?? 0 };
    })
    .sort((a, b) => {
      if (a.lastCompleted && b.lastCompleted) return a.lastCompleted < b.lastCompleted ? 1 : -1;
      if (a.lastCompleted) return -1;
      if (b.lastCompleted) return 1;
      return a.name.localeCompare(b.name);
    });
  return { today, roster };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// The checklist generator calls the model; give it room to finish instead of
// hitting the platform's short default function timeout.
export const maxDuration = 60;

export default async function AccountabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isSuperAdmin = profile.accessRole === "super_admin";
  const canEdit = canEditSection(profile.accessRole, "accountability", profile.permissionOverrides);

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
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
    dailyTemplateItems,
    preShiftTemplateItems,
    loyaltyTemplateItems,
    serverTemplateItems,
  ] = await Promise.all([
    discountsQ,
    spotChecksQ,
    dailyChecksQ,
    preShiftChecksQ,
    ambianceChecksQ,
    coachingLogsQ,
    supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
    getOrgLocations(),
    getChecklistItems("daily"),
    getChecklistItems("preshift"),
    getChecklistItems("loyalty"),
    getChecklistItems("server"),
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

  // --- Per-staff checklists: personal cards + manager reports (pre-shift + FOH loyalty) ---
  const todayStr = new Date().toISOString().slice(0, 10);

  // Custom (owner-created) role checklists + their items.
  const { data: customRows } = await supabase.from("custom_checklists").select("id, title, departments, sort_order").order("sort_order");
  const customChecklists = (customRows ?? []) as { id: string; title: string; departments: string[] | null; sort_order: number }[];
  const customItemsRaw = await Promise.all(customChecklists.map((c) => getChecklistItems(c.id)));
  let customLists = customChecklists.map((c, i) => ({ ...c, departments: c.departments ?? [], items: customItemsRaw[i].map((it) => it.item) }));
  const customIds = customLists.map((c) => c.id);
  // The viewer's own department decides which role checklists they personally run.
  const { data: myStaffRow } = await supabase.from("staff_members").select("department").eq("profile_id", profile.userId).maybeSingle();
  const myDepartment = (myStaffRow as { department?: string } | null)?.department ?? null;

  let preShiftItemTexts = preShiftTemplateItems.map((i) => i.item);
  let loyaltyItemTexts = loyaltyTemplateItems.map((i) => i.item);
  let serverItemTexts = serverTemplateItems.map((i) => i.item);
  // Render the staff-facing checklist items in the viewer's language (order is
  // preserved, so completion-by-index is unaffected). Managers' English config
  // is untouched.
  if (profile.language !== "en") {
    const tx = await translateTexts(profile.orgId, profile.language, [
      ...preShiftItemTexts,
      ...loyaltyItemTexts,
      ...serverItemTexts,
      ...customLists.flatMap((c) => c.items),
    ]);
    preShiftItemTexts = preShiftItemTexts.map((s) => tx.get(s) ?? s);
    loyaltyItemTexts = loyaltyItemTexts.map((s) => tx.get(s) ?? s);
    serverItemTexts = serverItemTexts.map((s) => tx.get(s) ?? s);
    customLists = customLists.map((c) => ({ ...c, items: c.items.map((s) => tx.get(s) ?? s) }));
  }
  // Cards the viewer personally runs: all-staff checklists (no roles) + ones that
  // include their role.
  const myCustomLists = customLists.filter((c) => c.departments.length === 0 || (myDepartment != null && c.departments.includes(myDepartment)));

  // Staff departments — used to decide which role a person is in (for checklist
  // visibility) and to roster the completion reports.
  const { data: staffDeptRows } = await supabase.from("staff_members").select("profile_id, department").not("profile_id", "is", null);
  // Full roster (name + department) for the spot-check staff picker.
  const { data: staffRosterRows } = await supabase.from("staff_members").select("full_name, department").order("full_name");
  const spotCheckStaff = ((staffRosterRows ?? []) as { full_name: string; department: string }[]).filter((s) => s.full_name);
  // Every role the company actually uses — any department that has staff, or that
  // the owner has set up standards or training for. Used for spot-check and
  // role-checklist assignment so we offer real roles, not the full master list.
  // Falls back to all roles when the org hasn't set anything up yet.
  const [{ data: stdDeptRows }, { data: trainDeptRows }] = await Promise.all([
    supabase.from("department_standards").select("department"),
    supabase.from("department_training_items").select("department"),
  ]);
  const rolesInUse = ((): string[] => {
    const present = new Set<string>([
      ...((staffRosterRows ?? []) as { department: string }[]).map((s) => s.department),
      ...((stdDeptRows ?? []) as { department: string }[]).map((d) => d.department),
      ...((trainDeptRows ?? []) as { department: string }[]).map((d) => d.department),
    ]);
    const ordered = ALL_DEPARTMENTS.filter((d) => present.has(d));
    return ordered.length ? ordered : [...ALL_DEPARTMENTS];
  })();

  // Role assignment for the built-in staff checklists. A stored row (departments
  // may be empty = all staff) overrides the app's default audience; no row keeps
  // the default (pre-shift = all, server/loyalty = front-of-house).
  const { data: assignRows } = await supabase.from("checklist_assignments").select("checklist_type, departments");
  const assignMap = new Map<string, string[]>();
  for (const a of (assignRows ?? []) as { checklist_type: string; departments: string[] | null }[]) assignMap.set(a.checklist_type, a.departments ?? []);
  const fohInUse = FOH_DEPARTMENTS.filter((d) => rolesInUse.includes(d));
  const effRoles = (type: "preshift" | "server" | "loyalty"): string[] => {
    const row = assignMap.get(type);
    if (row) return row; // stored assignment wins ([] = all staff)
    return type === "preshift" ? [] : fohInUse; // defaults
  };
  const seesChecklist = (type: "preshift" | "server" | "loyalty"): boolean => {
    const roles = effRoles(type);
    return roles.length === 0 || (myDepartment != null && roles.includes(myDepartment));
  };

  const canSeeReport = profile.accessRole !== "staff";
  const showPreshiftCard = seesChecklist("preshift");
  const showServerCard = seesChecklist("server");
  const showLoyaltyCard = seesChecklist("loyalty");

  const { data: myCompletions } = await supabase
    .from("shift_checklist_completions")
    .select("checklist_type, checked, completed_count, item_count, updated_at, created_at")
    .eq("profile_id", profile.userId)
    .in("checklist_type", ["preshift", "loyalty", "server", ...customIds])
    .eq("occurred_on", todayStr);
  const myByType = new Map<string, { checked?: boolean[]; updated_at?: string; created_at?: string }>();
  for (const c of (myCompletions ?? []) as { checklist_type: string; checked: boolean[]; updated_at: string; created_at: string }[]) myByType.set(c.checklist_type, c);
  const myPreshift = myByType.get("preshift");
  const myLoyalty = myByType.get("loyalty");
  const myServer = myByType.get("server");
  const myChecked = myPreshift?.checked ?? [];
  const myCompletedAt = myPreshift?.updated_at ?? myPreshift?.created_at ?? null;
  const myLoyaltyChecked = myLoyalty?.checked ?? [];
  const myLoyaltyCompletedAt = myLoyalty?.updated_at ?? myLoyalty?.created_at ?? null;
  const myServerChecked = myServer?.checked ?? [];
  const myServerCompletedAt = myServer?.updated_at ?? myServer?.created_at ?? null;

  // Everything the viewer personally runs, gathered into one hub. Built-ins use
  // their localized titles; custom checklists use the owner's title.
  const hubChecklists: HubChecklist[] = [
    showPreshiftCard
      ? { key: "preshift", title: tr(profile.language, "checklist.preshift.title"), items: preShiftItemTexts, done: Boolean(myPreshift), completedChecked: myChecked, completedAt: myCompletedAt }
      : null,
    showServerCard
      ? { key: "server", title: tr(profile.language, "checklist.server.title"), items: serverItemTexts, done: Boolean(myServer), completedChecked: myServerChecked, completedAt: myServerCompletedAt }
      : null,
    showLoyaltyCard
      ? { key: "loyalty", title: tr(profile.language, "checklist.loyalty.title"), items: loyaltyItemTexts, done: Boolean(myLoyalty), completedChecked: myLoyaltyChecked, completedAt: myLoyaltyCompletedAt }
      : null,
    ...myCustomLists.map((c) => {
      const comp = myByType.get(c.id);
      return { key: c.id, title: c.title, items: c.items, done: Boolean(comp), completedChecked: comp?.checked ?? [], completedAt: comp?.updated_at ?? comp?.created_at ?? null };
    }),
  ].filter((x): x is HubChecklist => x !== null);

  let todayCompletions: TodayCompletion[] = [];
  let roster: RosterRow[] = [];
  let loyaltyToday: TodayCompletion[] = [];
  let loyaltyRoster: RosterRow[] = [];
  let serverToday: TodayCompletion[] = [];
  let serverRoster: RosterRow[] = [];
  let customReports: { id: string; title: string; today: TodayCompletion[]; roster: RosterRow[] }[] = [];
  if (canSeeReport) {
    const thirtyDaysAgo = daysAgoIso(30);
    let compQ = supabase
      .from("shift_checklist_completions")
      .select("profile_id, checklist_type, occurred_on, completed_count, item_count, updated_at, created_at")
      .in("checklist_type", ["preshift", "loyalty", "server", ...customIds])
      .gte("occurred_on", thirtyDaysAgo)
      .order("occurred_on", { ascending: false });
    if (effectiveLocation) compQ = compQ.eq("location_id", effectiveLocation);

    const [{ data: comps }, { data: profs }] = await Promise.all([
      compQ,
      supabase.from("profiles").select("id, full_name, access_role, location_id"),
    ]);

    const nameById = new Map<string, string>();
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);

    const allComps = (comps ?? []) as (CompRow & { checklist_type: string })[];
    const preComps = allComps.filter((c) => c.checklist_type === "preshift");
    const loyComps = allComps.filter((c) => c.checklist_type === "loyalty");
    const srvComps = allComps.filter((c) => c.checklist_type === "server");

    // Base roster: staff + managers (owner excluded), scoped to location.
    const baseRoster = ((profs ?? []) as { id: string; full_name: string; access_role: string; location_id: string | null }[])
      .filter((p) => p.access_role !== "super_admin")
      .filter((p) => !effectiveLocation || p.location_id === effectiveLocation);
    // Each checklist's roster is exactly the roles it's assigned to (empty = all).
    const deptByProfile = new Map<string, string>();
    for (const s of (staffDeptRows ?? []) as { profile_id: string | null; department: string }[]) {
      if (s.profile_id) deptByProfile.set(s.profile_id, s.department);
    }
    const rosterForRoles = (roles: string[]) =>
      roles.length === 0 ? baseRoster : baseRoster.filter((p) => roles.includes(deptByProfile.get(p.id) ?? ""));

    ({ today: todayCompletions, roster } = buildChecklistReport(preComps, todayStr, nameById, rosterForRoles(effRoles("preshift"))));
    ({ today: loyaltyToday, roster: loyaltyRoster } = buildChecklistReport(loyComps, todayStr, nameById, rosterForRoles(effRoles("loyalty"))));
    ({ today: serverToday, roster: serverRoster } = buildChecklistReport(srvComps, todayStr, nameById, rosterForRoles(effRoles("server"))));

    // A report per custom checklist, rostered to its assigned roles (or all staff).
    customReports = customLists.map((c) => {
      const comps = allComps.filter((x) => x.checklist_type === c.id);
      const built = buildChecklistReport(comps, todayStr, nameById, rosterForRoles(c.departments));
      return { id: c.id, title: c.title, today: built.today, roster: built.roster };
    });
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Catch drift before it sets in</h1>
          <p className="text-base text-muted max-w-xl">
            Spot-checks, coaching flags, and daily checklists that keep the standard honest.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <PrintChecklistsButton
            options={[
              { type: "daily", label: "Manager daily checklist" },
              { type: "preshift", label: "Pre-shift checklist" },
              { type: "server", label: "Server standards checklist" },
              { type: "loyalty", label: "FOH loyalty checklist" },
              ...customLists.map((c) => ({ type: c.id, label: c.title })),
            ]}
          />
          {!canEdit && <Pill>View only</Pill>}
          {canEdit && (
            <>
              <DailyCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
                items={dailyTemplateItems.map((i) => i.item)}
              />
              <SpotCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
                staff={spotCheckStaff}
                departmentOptions={rolesInUse}
              />
              <PreShiftCheckModalButton
                locations={locations}
                isGm={isSuperAdmin}
                lockedLocationName={profile.locationName}
                defaultLocationId={effectiveLocation ?? profile.locationId}
                items={preShiftTemplateItems.map((i) => i.item)}
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

      {/* Staff view: one hub for every checklist assigned to the viewer. */}
      {hubChecklists.length > 0 && <MyChecklistsHub checklists={hubChecklists} lang={profile.language} />}

      {/* Manager view: a completion report per checklist. */}
      {canSeeReport && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PreshiftReport today={todayCompletions} roster={roster} />
          <PreshiftReport
            today={serverToday}
            roster={serverRoster}
            title="Server checklist acknowledgment"
            sub="Which servers acknowledged the standard before their shift. Only reflects days they worked."
            emptyToday="No servers have acknowledged their checklist yet today."
          />
          <PreshiftReport
            today={loyaltyToday}
            roster={loyaltyRoster}
            title="FOH loyalty checklist completion"
            sub="Which front-of-house staff worked their loyalty checklist. Only reflects days they worked."
            emptyToday="No FOH staff have completed their loyalty checklist yet today."
          />
          {customReports.map((r) => (
            <PreshiftReport
              key={r.id}
              today={r.today}
              roster={r.roster}
              title={`${r.title} — completion`}
              sub="Who completed this checklist. Only reflects days they worked."
              emptyToday="No one has completed this checklist yet today."
            />
          ))}
        </div>
      )}

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

      {isSuperAdmin && (
        <div>
          <h3 className="font-display text-lg font-semibold mb-1 text-ink">Checklist templates</h3>
          <p className="text-sm text-muted mb-4">
            Only the account owner can edit these — add, remove, or rebuild what every manager and staff member is checked against.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ChecklistTemplateEditor checklistType="daily" title="Manager daily checklist" items={dailyTemplateItems} />
            <div className="flex flex-col gap-2">
              <ChecklistRolesBar checklistType="preshift" departments={effRoles("preshift")} options={rolesInUse} />
              <ChecklistTemplateEditor checklistType="preshift" title="Pre-shift staff checklist" items={preShiftTemplateItems} />
            </div>
            <div className="flex flex-col gap-2">
              <ChecklistRolesBar checklistType="server" departments={effRoles("server")} options={rolesInUse} />
              <ChecklistTemplateEditor checklistType="server" title="Server standards checklist" items={serverTemplateItems} />
            </div>
            <div className="flex flex-col gap-2">
              <ChecklistRolesBar checklistType="loyalty" departments={effRoles("loyalty")} options={rolesInUse} />
              <ChecklistTemplateEditor checklistType="loyalty" title="FOH loyalty checklist" items={loyaltyTemplateItems} />
            </div>
          </div>

          <div className="mt-8">
            <CustomChecklistsManager
              departments={rolesInUse}
              checklists={customChecklists.map((c, i) => ({ id: c.id, title: c.title, departments: c.departments ?? [], sort_order: c.sort_order, items: customItemsRaw[i] }))}
            />
          </div>
        </div>
      )}

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
