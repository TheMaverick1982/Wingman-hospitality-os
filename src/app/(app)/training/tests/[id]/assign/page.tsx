import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { getStaffMembers } from "@/lib/data/staff";
import { ArrowLeft, Pencil } from "lucide-react";
import { AssignAndResults, type AssignmentRow } from "../assign-results";

export default async function AssignTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");
  // Assigning is a manager+ action; a view-only role gets bounced to the test.
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) redirect(`/training/tests/${id}`);

  const supabase = await createClient();
  const [{ data: test }, { data: assignmentRows }, { data: meta }, staff] = await Promise.all([
    supabase.from("tests").select("id, title, description, pass_pct").eq("id", id).maybeSingle(),
    supabase.from("test_assignments").select("id, staff_id, status, attempts_used, best_score, last_score, due_at, locked_at, staff_members(full_name, department)").eq("test_id", id),
    supabase.from("department_meta").select("department"),
    getStaffMembers(null),
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
  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link href="/training/tests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors">
          <ArrowLeft size={14} /> All tests
        </Link>
        <Link href={`/training/tests/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
          <Pencil size={13} /> Edit the test
        </Link>
      </div>

      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">Assign — {test.title}</h1>
        <p className="text-[15px] text-muted mt-1">Now that it&rsquo;s built, assign it to specific people, a role, or everyone — and track who&rsquo;s completed it.</p>
      </div>

      <AssignAndResults
        testId={id}
        passPct={test.pass_pct}
        assignments={assignments}
        staff={staff.map((s) => ({ id: s.id, full_name: s.full_name, department: s.department }))}
        activeDepartments={activeDepts as Department[]}
      />
    </>
  );
}
