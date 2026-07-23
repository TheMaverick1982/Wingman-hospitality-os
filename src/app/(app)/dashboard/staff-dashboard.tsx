import Link from "next/link";
import { GraduationCap, ClipboardList, Sparkle, ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";

// Personal dashboard for the staff role — their own tests, training, checklist,
// and this week's focus, instead of the restaurant-wide manager view.
//
// RLS note: test_assignments and staff_training_progress are manager-only, so
// those are read with the admin client scoped to this staffer's own rows. The
// org row and the staffer's roster row read fine with the normal client.
type TestEmbed = { title: string | null; pass_pct: number | null };
type AssignmentRow = {
  test_id: string;
  status: string;
  best_score: number | null;
  last_score: number | null;
  due_at: string | null;
  // Supabase types the embed as an array; at runtime it's the single joined row.
  tests: TestEmbed | TestEmbed[] | null;
};

const STATUS: Record<string, { label: string; fg: string; bg: string; dot: string }> = {
  assigned: { label: "Not started", fg: "text-brick-dark", bg: "bg-brick-tint", dot: "bg-brick" },
  in_progress: { label: "In progress", fg: "text-[#b45309]", bg: "bg-gold-tint", dot: "bg-[#d9922a]" },
  passed: { label: "Passed", fg: "text-[#15803d]", bg: "bg-olive-tint", dot: "bg-olive" },
  locked: { label: "Locked", fg: "text-danger", bg: "bg-danger-tint", dot: "bg-danger" },
};

export async function StaffDashboard({
  userId,
  orgId,
  fullName,
}: {
  userId: string;
  orgId: string;
  fullName: string;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const firstName = fullName.split(" ")[0] || "there";

  const { data: myStaff } = await admin
    .from("staff_members")
    .select("id, department")
    .eq("profile_id", userId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!myStaff) {
    return (
      <>
        <StaffGreeting firstName={firstName} />
        <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center">
          <p className="text-[15px] text-ink font-semibold">Your login isn&rsquo;t linked to your staff profile yet.</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Ask a manager to connect your account on the Staff page — then your training and tests will show up here.
          </p>
        </div>
      </>
    );
  }

  const staffId = myStaff.id;
  const department = myStaff.department;

  const [{ data: org }, { data: standards }, { data: trainingItems }, { data: progress }, { data: assignmentsData }] =
    await Promise.all([
      supabase.from("organizations").select("weekly_focus, weekly_experiment").single(),
      supabase.from("department_standards").select("id").eq("department", department),
      supabase.from("department_training_items").select("id").eq("department", department),
      admin.from("staff_training_progress").select("item_type, item_id, checked").eq("staff_id", staffId),
      admin
        .from("test_assignments")
        .select("test_id, status, best_score, last_score, due_at, tests(title, pass_pct)")
        .eq("staff_id", staffId)
        .order("assigned_at", { ascending: false }),
    ]);

  const weeklyFocus = (org as { weekly_focus?: string | null } | null)?.weekly_focus || "";
  const weeklyExperiment = (org as { weekly_experiment?: string | null } | null)?.weekly_experiment || "";

  // "Your training %": how many of your department's standards + training items
  // are checked off.
  const checkedKeys = new Set(
    ((progress ?? []) as { item_type: string; item_id: string; checked: boolean }[])
      .filter((p) => p.checked)
      .map((p) => `${p.item_type}:${p.item_id}`)
  );
  const allItemKeys = [
    ...((standards ?? []) as { id: string }[]).map((s) => `standard:${s.id}`),
    ...((trainingItems ?? []) as { id: string }[]).map((t) => `training:${t.id}`),
  ];
  const trainingPct =
    allItemKeys.length > 0
      ? Math.round((allItemKeys.filter((k) => checkedKeys.has(k)).length / allItemKeys.length) * 100)
      : 0;

  const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];
  const testOf = (a: AssignmentRow) => (Array.isArray(a.tests) ? a.tests[0] : a.tests) ?? null;
  const toDo = assignments.filter((a) => a.status === "assigned" || a.status === "in_progress");
  const passedCount = assignments.filter((a) => a.status === "passed").length;

  return (
    <>
      <StaffGreeting firstName={firstName} />

      {(weeklyFocus || weeklyExperiment) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {weeklyFocus && (
            <div className="flex items-start gap-3 bg-gold-tint rounded-2xl px-5 py-4">
              <Sparkle size={16} className="text-[#b45309] shrink-0 mt-0.5" />
              <span className="text-sm text-[#b45309]">
                <span className="font-semibold">This week&rsquo;s focus:</span> {weeklyFocus}
              </span>
            </div>
          )}
          {weeklyExperiment && (
            <div className="flex items-start gap-3 bg-gold-tint rounded-2xl px-5 py-4">
              <Sparkle size={16} className="text-[#b45309] shrink-0 mt-0.5" />
              <span className="text-sm text-[#b45309]">
                <span className="font-semibold">This week&rsquo;s experiment:</span> {weeklyExperiment}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard label="Training complete" value={`${trainingPct}%`} sub="of your role's standards" />
        <KpiCard label="Tests to take" value={String(toDo.length)} sub="assigned to you" />
        <KpiCard label="Tests passed" value={String(passedCount)} sub="nice work" />
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Your tests</div>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        {assignments.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {assignments.map((a) => {
              const t = testOf(a);
              const s = STATUS[a.status] ?? STATUS.assigned;
              const score = a.best_score ?? a.last_score;
              const done = a.status === "passed" || a.status === "locked";
              const inner = (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GraduationCap size={17} className="text-brick shrink-0" />
                    <span className="text-sm font-semibold text-ink truncate">{t?.title ?? "Test"}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {score != null && (
                      <span className="text-[12.5px] tabular-nums text-muted">
                        {score}%{t?.pass_pct != null ? ` · pass ${t.pass_pct}%` : ""}
                      </span>
                    )}
                    <StatusPill label={s.label} fg={s.fg} bg={s.bg} dot={s.dot} />
                    {!done && <ArrowRight size={15} className="text-brick" />}
                  </div>
                </>
              );
              const rowClass =
                "flex items-center justify-between gap-3 p-3.5 rounded-xl border border-line";
              return done ? (
                <div key={a.test_id} className={`${rowClass} bg-paper`}>{inner}</div>
              ) : (
                <Link
                  key={a.test_id}
                  href={`/training/tests/${a.test_id}/take`}
                  className={`${rowClass} bg-white hover:border-brick transition-colors`}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted flex items-center gap-2">
            <CheckCircle2 size={16} className="text-olive" /> No tests assigned right now — you&rsquo;re all caught up.
          </p>
        )}
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Your day</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Link
          href="/accountability"
          className="flex items-center gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm hover:border-brick transition-colors group"
        >
          <span className="w-11 h-11 rounded-[12px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <ListChecks size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Your pre-shift checklist</div>
            <div className="text-[13px] text-muted-2">Run through today&rsquo;s checklist before your shift.</div>
          </div>
          <ArrowRight size={17} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>

        <Link
          href="/training"
          className="flex items-center gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm hover:border-brick transition-colors group"
        >
          <span className="w-11 h-11 rounded-[12px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <ClipboardList size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Your training</div>
            <div className="text-[13px] text-muted-2">See your standards and keep learning.</div>
          </div>
          <ArrowRight size={17} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>
      </div>
    </>
  );
}

function StaffGreeting({ firstName }: { firstName: string }) {
  return (
    <div>
      <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] leading-[1.12] text-ink mb-1.5 text-balance">
        Hi {firstName}
      </h1>
      <p className="text-base text-muted">Your training, tests, and today&rsquo;s focus — all in one place.</p>
    </div>
  );
}
