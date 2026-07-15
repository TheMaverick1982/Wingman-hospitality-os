import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { ArrowLeft, ArrowRight, ClipboardList } from "lucide-react";
import { translateTexts } from "@/lib/translate";
import { TestsClient } from "./tests-client";

// AI generation runs from this route — give it room past the default timeout.
export const maxDuration = 60;

type TestRow = {
  id: string;
  title: string;
  description: string;
  mode: string;
  target_departments: string[];
  day_count: number;
  pass_pct: number;
  rotates_monthly: boolean;
  active: boolean;
  created_at: string;
  brand_locked?: boolean;
};

export default async function TestsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);

  const supabase = await createClient();
  const [{ data: tests }, { data: meta }, { data: qCounts }, { data: assignRows }] = await Promise.all([
    supabase.from("tests").select("id, title, description, mode, target_departments, day_count, pass_pct, rotates_monthly, active, created_at, brand_locked").order("created_at", { ascending: false }),
    supabase.from("department_meta").select("department"),
    supabase.from("test_questions").select("test_id"),
    canEdit ? supabase.from("test_assignments").select("test_id, status") : Promise.resolve({ data: [] }),
  ]);

  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));
  const questionCount = new Map<string, number>();
  for (const r of (qCounts ?? []) as { test_id: string }[]) questionCount.set(r.test_id, (questionCount.get(r.test_id) ?? 0) + 1);
  // Per-test assignment tally (assigned total + passed) for the list summary.
  const assignTally = new Map<string, { total: number; passed: number }>();
  for (const r of (assignRows ?? []) as { test_id: string; status: string }[]) {
    const e = assignTally.get(r.test_id) ?? { total: 0, passed: 0 };
    e.total++;
    if (r.status === "passed") e.passed++;
    assignTally.set(r.test_id, e);
  }

  const allRows = ((tests ?? []) as TestRow[]).map((t) => ({
    ...t,
    questions: questionCount.get(t.id) ?? 0,
    assigned: assignTally.get(t.id)?.total ?? 0,
    passed: assignTally.get(t.id)?.passed ?? 0,
  }));
  // Archived tests (active = false) drop out of the main list into their own
  // collapsed section, so a monthly LTO's past months don't clutter things.
  const rows = allRows.filter((t) => t.active !== false);
  const archivedRows = allRows.filter((t) => t.active === false);

  // Tests assigned to the person viewing (their own to take). Read via admin so
  // a staff member sees only their own assignment rows.
  const admin = createAdminClient();
  const { data: myStaff } = await admin.from("staff_members").select("id").eq("profile_id", profile.userId).eq("org_id", profile.orgId).maybeSingle();
  let myAssignments: { testId: string; title: string; status: string; day: number; dayCount: number; score: number | null; passPct: number; due: string | null }[] = [];
  if (myStaff) {
    const { data: mine } = await admin
      .from("test_assignments")
      .select("test_id, status, current_day, best_score, last_score, due_at, tests(title, day_count, pass_pct)")
      .eq("staff_id", (myStaff as { id: string }).id);
    myAssignments = ((mine ?? []) as unknown as {
      test_id: string; status: string; current_day: number; best_score: number | null; last_score: number | null; due_at: string | null;
      tests: { title: string; day_count: number; pass_pct: number } | null;
    }[]).map((m) => ({
      testId: m.test_id,
      title: m.tests?.title ?? "Test",
      status: m.status,
      day: m.current_day,
      dayCount: m.tests?.day_count ?? 1,
      score: m.best_score ?? m.last_score,
      passPct: m.tests?.pass_pct ?? 80,
      due: m.due_at,
    }));
    // Show the assigned-test titles in the staffer's language too.
    if (profile.language !== "en" && myAssignments.length > 0) {
      const tx = await translateTexts(profile.orgId, profile.language, myAssignments.map((m) => m.title));
      myAssignments = myAssignments.map((m) => ({ ...m, title: tx.get(m.title) ?? m.title }));
    }
  }

  const MY_TONE: Record<string, string> = { assigned: "bg-paper text-charcoal-2", in_progress: "bg-brick-tint text-brick-dark", passed: "bg-[#E7F6EC] text-[#15803D]", locked: "bg-danger-tint text-danger" };
  const MY_LABEL: Record<string, string> = { assigned: "Not started", in_progress: "In progress", passed: "Passed", locked: "Locked" };

  return (
    <>
      {myAssignments.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Assigned to you</div>
          <div className="flex flex-col gap-2">
            {myAssignments.map((m) => (
              <Link key={m.testId} href={`/training/tests/${m.testId}/take`} className="flex items-center gap-3 border border-line rounded-xl px-4 py-3 hover:border-brick transition-colors">
                <ClipboardList size={16} className="text-brick shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-ink truncate">{m.title}</div>
                  <div className="text-[12.5px] text-muted">Day {Math.min(m.day, m.dayCount)} of {m.dayCount}{m.score != null ? ` · last ${m.score}% (pass ${m.passPct}%)` : ""}</div>
                </div>
                <span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full ${MY_TONE[m.status] ?? MY_TONE.assigned}`}>{MY_LABEL[m.status] ?? "Assigned"}</span>
                {m.status !== "passed" && m.status !== "locked" && <span className="text-[13px] font-semibold text-brick inline-flex items-center gap-1 shrink-0">Take <ArrowRight size={13} /></span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <Link href="/training" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors mb-3">
          <ArrowLeft size={14} /> Back to Training
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div>
            <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Tests &amp; exams</h1>
            <p className="text-base text-muted max-w-xl">
              Build a test the same way you build training — let AI write it, or paste what you have and AI makes it better.
              Score it automatically, then assign it to your team and see who passed.
            </p>
          </div>
          {rows.length > 0 && (
            <a href="#your-tests" className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
              <ClipboardList size={14} /> Your tests ({rows.length})
            </a>
          )}
        </div>
      </div>

      <TestsClient
        tests={rows}
        archived={archivedRows}
        activeDepartments={activeDepts as Department[]}
        canEdit={canEdit}
      />
    </>
  );
}
