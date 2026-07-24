import Link from "next/link";
import { ClipboardList, CalendarClock, ArrowRight, Route, Trophy } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeLeaderboard } from "@/lib/leaderboard";
import { canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { Pill } from "@/components/ui/pill";
import { TrainingClient, type DeptData, type RoleSummary } from "./training-client";
import { SignoffLog } from "./signoff-log";
import { StaffTests } from "@/components/dashboard/staff-tests";
import { getMyTests, isTestToDo } from "@/lib/data/staff-tests";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StartTrainingButton } from "./start-training-button";
import { StartTestButton, type TestOption } from "./start-test-button";
import { RoleManager } from "../role-manager";

// AI generation/refinement server actions run from this route; give them room
// to finish instead of hitting the platform's short default function timeout
// (which surfaces as "Unexpected end of JSON input" in the browser).
export const maxDuration = 60;

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);

  // Standards, skills, and the menu are one shared set per org (correct), but
  // training sign-offs are per-location — scope the completion rollups + log to
  // the selected location so a multi-location operator sees one store at a time
  // instead of every location blended together.
  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  // Training leaderboard (compact top 3) — shown to everyone when the owner has
  // it enabled.
  const leaderAdmin = createAdminClient();
  const { data: lbOrg } = await leaderAdmin.from("organizations").select("leaderboard_enabled").eq("id", profile.orgId).maybeSingle();
  const leaderboardEnabled = (lbOrg as { leaderboard_enabled?: boolean } | null)?.leaderboard_enabled ?? true;
  const leaderTop = leaderboardEnabled ? (await computeLeaderboard(profile.orgId, profile.allLocations ? null : effectiveLocation)).slice(0, 3) : [];

  // Staff see only their own department's training — resolve it from their roster row.
  const isStaff = profile.accessRole === "staff";
  let myDept: string | null = null;
  let myStaffId: string | null = null;
  if (isStaff) {
    const { data: myStaffRow } = await leaderAdmin
      .from("staff_members")
      .select("id, department")
      .eq("profile_id", profile.userId)
      .eq("org_id", profile.orgId)
      .is("deleted_at", null)
      .maybeSingle();
    const row = myStaffRow as { id: string; department: string } | null;
    myStaffId = row?.id ?? null;
    myDept = row?.department ?? null;
  }

  // Anyone on the roster (staff OR manager) sees their own assigned tests + scores.
  const myTests = await getMyTests(profile.userId, profile.orgId);

  const supabase = await createClient();
  let signoffsQ = supabase
    .from("training_signoffs")
    .select("id, staff_name, department, completion_pct, occurred_on")
    .order("occurred_on", { ascending: false });
  if (effectiveLocation) signoffsQ = signoffsQ.eq("location_id", effectiveLocation);

  const [
    { data: standards },
    { data: trainingItems },
    { data: meta },
    { data: menuItems },
    { data: signoffs },
    { data: testRows },
    { data: testQ },
    locations,
    staff,
  ] = await Promise.all([
    supabase.from("department_standards").select("id, department, item, sort_order, source").order("sort_order"),
    supabase.from("department_training_items").select("id, department, item, sort_order, source").order("sort_order"),
    supabase.from("department_meta").select("department, track_label, has_menu"),
    supabase
      .from("menu_items")
      .select("id, department, name, description, category, price, allergens, pairing_suggestion, upsell_suggestion, source, popularity_pct, profit_amount")
      .order("sort_order"),
    signoffsQ,
    canEdit ? supabase.from("tests").select("id, title, target_departments, day_count, rotates_monthly, mode").eq("active", true).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    canEdit ? supabase.from("test_questions").select("test_id") : Promise.resolve({ data: [] }),
    getOrgLocations(),
    getStaffMembers(effectiveLocation),
  ]);

  // Tests available to hand out via the "Start a test" flow (managers only).
  const qCount = new Map<string, number>();
  for (const r of (testQ ?? []) as { test_id: string }[]) qCount.set(r.test_id, (qCount.get(r.test_id) ?? 0) + 1);
  const allTestRows = (testRows ?? []) as { id: string; title: string; target_departments: string[] | null; day_count: number; rotates_monthly?: boolean; mode?: string }[];
  const testOptions: TestOption[] = allTestRows.map((t) => ({
    id: t.id,
    title: t.title,
    target_departments: (t.target_departments ?? []).filter(Boolean),
    day_count: t.day_count,
    questions: qCount.get(t.id) ?? 0,
  }));

  // Continuing-education = learn-then-quiz tests flagged to rotate monthly. Show
  // whether one exists org-wide (all staff) vs. role-specific, for the banner.
  const monthlyTests = allTestRows.filter((t) => t.rotates_monthly && t.mode === "study_quiz");
  const ceHasAllStaff = monthlyTests.some((t) => (t.target_departments ?? []).filter(Boolean).length === 0);
  const ceRoles = [...new Set(monthlyTests.flatMap((t) => (t.target_departments ?? []).filter(Boolean)))];

  // Which roles already have a test generated from their training (guarded on
  // its own so a not-yet-applied source_department migration can't break the
  // page — it just hides the "Update" affordance until then).
  let roleTestDepts: string[] = [];
  if (canEdit) {
    const { data: srcRows } = await supabase.from("tests").select("source_department").not("source_department", "is", null);
    roleTestDepts = [...new Set(((srcRows ?? []) as { source_department: string | null }[]).map((r) => r.source_department).filter((d): d is string => Boolean(d)))];
  }

  // The roles this restaurant runs = the ones with a department_meta row (set in
  // the wizard, managed here). Show only those; fall back to all if none exist.
  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));
  const inactiveDepts = ALL_DEPARTMENTS.filter((d) => !activeDepts.includes(d));
  const baseRenderDepts = activeDepts.length ? activeDepts : [...ALL_DEPARTMENTS];
  // Staff: restrict to their own department so they never see other roles' training.
  const renderDepts = isStaff && myDept ? baseRenderDepts.filter((d) => d === myDept) : baseRenderDepts;

  const allSignoffs = signoffs ?? [];
  const data = {} as Record<Department, DeptData>;
  const summaries = {} as Record<Department, RoleSummary>;
  for (const d of renderDepts) {
    const metaRow = meta?.find((m) => m.department === d);
    data[d] = {
      standards: (standards ?? []).filter((s) => s.department === d).map((s) => ({ id: s.id, item: s.item, source: s.source })),
      trainingItems: (trainingItems ?? []).filter((t) => t.department === d).map((t) => ({ id: t.id, item: t.item, source: t.source })),
      trackLabel: metaRow?.track_label ?? null,
      hasMenu: metaRow?.has_menu ?? false,
      menuItems: (menuItems ?? []).filter((m) => m.department === d),
    };

    const deptSignoffs = allSignoffs.filter((s) => s.department === d);
    const people = new Set(deptSignoffs.map((s) => s.staff_name)).size;
    const pct =
      deptSignoffs.length > 0
        ? Math.round(deptSignoffs.reduce((sum, s) => sum + s.completion_pct, 0) / deptSignoffs.length)
        : 0;
    summaries[d] = {
      people,
      pct,
      signoffCount: deptSignoffs.length,
      standardsCount: data[d].standards.length + data[d].trainingItems.length,
    };
  }

  const myToDo = myTests.filter(isTestToDo);
  const myPassed = myTests.filter((t) => t.status === "passed" || t.status === "locked");

  // Staff get a focused, personal Training page: their metrics + tests at the top,
  // then their results, then the standards for their role. No leaderboard, no
  // manager tools.
  if (isStaff) {
    let trainingPct = 0;
    if (myStaffId) {
      const { data: prog } = await leaderAdmin
        .from("staff_training_progress")
        .select("item_type, item_id, checked")
        .eq("staff_id", myStaffId);
      const checkedKeys = new Set(
        ((prog ?? []) as { item_type: string; item_id: string; checked: boolean }[])
          .filter((p) => p.checked)
          .map((p) => `${p.item_type}:${p.item_id}`)
      );
      const keys = [
        ...((standards ?? []) as { id: string; department: string }[]).filter((s) => s.department === myDept).map((s) => `standard:${s.id}`),
        ...((trainingItems ?? []) as { id: string; department: string }[]).filter((t) => t.department === myDept).map((t) => `training:${t.id}`),
      ];
      trainingPct = keys.length ? Math.round((keys.filter((k) => checkedKeys.has(k)).length / keys.length) * 100) : 0;
    }
    return (
      <>
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Your training &amp; standards</h1>
          <p className="text-base text-muted">Your tests, your progress, and the standards for your role.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <KpiCard label="Training complete" value={`${trainingPct}%`} sub="of your role's standards" />
          <KpiCard label="Tests to take" value={String(myToDo.length)} sub="assigned to you" />
          <KpiCard label="Tests passed" value={String(myPassed.filter((t) => t.status === "passed").length)} sub="nice work" />
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Tests to take</div>
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <StaffTests tests={myToDo} emptyLabel="No tests to take right now — nicely done." />
        </div>

        {myPassed.length > 0 && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Your results</div>
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <StaffTests tests={myPassed} emptyLabel="" />
            </div>
          </>
        )}

        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Your standards</div>
        <TrainingClient data={data} summaries={summaries} departments={renderDepts} isGm={false} staff={staff} locations={locations} roleTestDepts={roleTestDepts} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Training & standards</h1>
          <p className="text-base text-muted max-w-xl">
            Department-by-department progress toward your standard, with a real sign-off log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isStaff && (
            <>
              <Link href="/training/tests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
                <ClipboardList size={14} /> Build &amp; manage tests
              </Link>
              <Link href="/training/paths" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
                <Route size={14} /> Learning paths
              </Link>
            </>
          )}
          {leaderboardEnabled && (
            <Link href="/training/leaderboard" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
              <Trophy size={14} /> Leaderboard
            </Link>
          )}
          {!isStaff && (
            <a href="/print/training" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
              Print / PDF
            </a>
          )}
          {!canEdit && <Pill>View only</Pill>}
          {canEdit && <StartTrainingButton staff={staff} locations={locations} departments={renderDepts as Department[]} small />}
        </div>
      </div>

      {myTests.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Your tests &amp; results</div>
          <div className="text-[13px] text-muted mb-4">Take the ones outstanding, and see how you scored on the rest.</div>
          <StaffTests tests={myTests} emptyLabel="No tests assigned to you yet." />
        </div>
      )}

      {leaderTop.length > 0 && (
        <Link href="/training/leaderboard" className="bg-white border border-line rounded-2xl px-5 py-3.5 shadow-sm flex items-center gap-4 hover:border-brick transition-colors group">
          <Trophy size={18} className="text-[#B8860B] shrink-0" />
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2">Training leaders</span>
            {leaderTop.map((r, i) => (
              <span key={r.staffId} className="text-[13.5px] text-ink"><span className="font-semibold">{i + 1}. {r.name}</span> <span className="text-muted-2 tabular-nums">{r.points}</span></span>
            ))}
          </div>
          <ArrowRight size={15} className="text-muted-2 group-hover:text-brick transition-colors shrink-0" />
        </Link>
      )}

      {canEdit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="rounded-2xl border border-brick/20 bg-brick-tint/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-brick text-white flex items-center justify-center shrink-0">
            <ClipboardList size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Test your team</div>
            <p className="text-[13.5px] text-charcoal-2 mt-0.5 max-w-2xl">
              Turn any training into a graded online test. Pick who takes it — one person, a role, or all staff — choose the test(s), and send. Everyone gets a link, and you see who passed.
              {testOptions.length > 0 ? ` ${testOptions.length} test${testOptions.length === 1 ? "" : "s"} ready to assign.` : ""}
            </p>
          </div>
          <div className="shrink-0">
            <StartTestButton tests={testOptions} staff={staff} departments={renderDepts as Department[]} effectiveLocationId={effectiveLocation} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#cfe3d0] bg-olive-tint p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#15803d] text-white flex items-center justify-center shrink-0">
              <CalendarClock size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#14532d]">Make great hospitality a habit</div>
              <p className="text-[13.5px] text-[#166534] mt-0.5 max-w-2xl">
                Guest experience can&apos;t be taught in a two-day program — it&apos;s ongoing. Turn any learn-then-quiz test
                into an automatic <strong>monthly refresher</strong>: Wingman re-assigns it fresh on the 1st and emails your
                team. Set one core hospitality refresher for <strong>everyone</strong>, plus optional role-specific modules
                that only reach that department.
              </p>
              {monthlyTests.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[12px] text-[#166534] font-medium">Running monthly:</span>
                  {ceHasAllStaff && (
                    <span className="text-[12px] font-semibold text-[#14532d] bg-white/70 border border-[#cfe3d0] rounded-full px-2.5 py-0.5">All staff</span>
                  )}
                  {ceRoles.map((r) => (
                    <span key={r} className="text-[12px] font-semibold text-[#14532d] bg-white/70 border border-[#cfe3d0] rounded-full px-2.5 py-0.5">{r}</span>
                  ))}
                </div>
              ) : (
                <div className="text-[12.5px] text-[#166534] mt-2 font-medium">Not set up yet — build a short refresher and tick &ldquo;Continuing education&rdquo; on it.</div>
              )}
            </div>
            <div className="shrink-0">
              <Link
                href="/training/continuing-education"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-[#15803d] rounded-full px-4 py-2.5 hover:bg-[#166534] transition-colors"
              >
                {monthlyTests.length > 0 ? "Manage monthly training" : "Set up continuing education"}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
        </div>
      )}

      {!isStaff && <RoleManager active={activeDepts} inactive={inactiveDepts} canManage={canEdit} />}

      <TrainingClient data={data} summaries={summaries} departments={renderDepts} isGm={canEdit} staff={staff} locations={locations} roleTestDepts={roleTestDepts} />

      {!isStaff && <SignoffLog signoffs={allSignoffs} />}
    </>
  );
}
