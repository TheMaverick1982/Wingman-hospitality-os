import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { getStaffMembers } from "@/lib/data/staff";
import { ArrowLeft } from "lucide-react";
import { TestEditor } from "./test-editor";
import { AssignAndResults, type AssignmentRow } from "./assign-results";
import type { TestDay, TestQuestion, TestSettings } from "@/lib/tests";

export const maxDuration = 60;

export default async function TestEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);

  const supabase = await createClient();
  const [{ data: test }, { data: days }, { data: questions }, { data: meta }, { data: assignmentRows }, staff] = await Promise.all([
    supabase.from("tests").select("*").eq("id", id).maybeSingle(),
    supabase.from("test_days").select("id, day_number, title, content").eq("test_id", id).order("day_number"),
    supabase.from("test_questions").select("id, day_number, sort_order, kind, prompt, options, correct_index, explanation").eq("test_id", id).order("day_number").order("sort_order"),
    supabase.from("department_meta").select("department"),
    canEdit
      ? supabase.from("test_assignments").select("id, staff_id, status, attempts_used, best_score, last_score, due_at, locked_at, staff_members(full_name, department)").eq("test_id", id)
      : Promise.resolve({ data: [] }),
    canEdit ? getStaffMembers(null) : Promise.resolve([]),
  ]);
  if (!test) notFound();

  const assignments: AssignmentRow[] = ((assignmentRows ?? []) as unknown as {
    id: string; staff_id: string; status: string; attempts_used: number; best_score: number | null; last_score: number | null; due_at: string | null; locked_at: string | null;
    staff_members: { full_name: string; department: string } | null;
  }[]).map((r) => ({
    id: r.id,
    staffName: r.staff_members?.full_name ?? "—",
    department: r.staff_members?.department ?? "",
    status: r.status,
    attemptsUsed: r.attempts_used,
    bestScore: r.best_score,
    lastScore: r.last_score,
    dueAt: r.due_at,
    lockedAt: r.locked_at,
  }));

  const settings: TestSettings = {
    title: test.title,
    description: test.description,
    mode: test.mode,
    target_departments: test.target_departments ?? [],
    day_count: test.day_count,
    pass_pct: test.pass_pct,
    max_retakes: test.max_retakes,
    complete_within_amount: test.complete_within_amount,
    complete_within_unit: test.complete_within_unit,
    rotates_monthly: test.rotates_monthly,
  };
  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));

  return (
    <>
      <div>
        <Link href="/training/tests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors mb-3">
          <ArrowLeft size={14} /> All tests
        </Link>
      </div>
      {canEdit && (
        <AssignAndResults
          testId={id}
          passPct={test.pass_pct}
          assignments={assignments}
          staff={staff.map((s) => ({ id: s.id, full_name: s.full_name, department: s.department }))}
          activeDepartments={activeDepts as Department[]}
        />
      )}

      <TestEditor
        testId={id}
        settings={settings}
        days={(days ?? []) as TestDay[]}
        questions={(questions ?? []) as TestQuestion[]}
        activeDepartments={activeDepts as Department[]}
        canEdit={canEdit}
      />
    </>
  );
}
