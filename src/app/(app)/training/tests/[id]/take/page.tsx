import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { ArrowLeft } from "lucide-react";
import { completionWindowLabel } from "@/lib/tests";
import { TakeClient } from "./take-client";

export default async function TakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: staff } = await admin.from("staff_members").select("id, full_name").eq("profile_id", profile.userId).eq("org_id", profile.orgId).maybeSingle();

  const backLink = (
    <Link href="/training/tests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors mb-3">
      <ArrowLeft size={14} /> Tests
    </Link>
  );
  const shell = (node: React.ReactNode) => (
    <>
      <div>{backLink}</div>
      {node}
    </>
  );

  if (!staff) {
    return shell(<div className="bg-white border border-line rounded-2xl p-8 text-center text-muted">Your login isn&rsquo;t linked to a staff record yet — ask a manager to add you.</div>);
  }
  const staffRow = staff as { id: string; full_name: string };

  const { data: aRow } = await admin
    .from("test_assignments")
    .select("id, test_id, status, current_day, attempts_used, best_score, last_score, due_at")
    .eq("test_id", id)
    .eq("staff_id", staffRow.id)
    .maybeSingle();
  if (!aRow) {
    return shell(<div className="bg-white border border-line rounded-2xl p-8 text-center text-muted">You haven&rsquo;t been assigned this test.</div>);
  }
  const a = aRow as { id: string; test_id: string; status: string; current_day: number; attempts_used: number; best_score: number | null; last_score: number | null; due_at: string | null };

  const { data: test } = await admin.from("tests").select("id, title, description, mode, day_count, pass_pct, max_retakes, complete_within_amount, complete_within_unit").eq("id", id).single();
  const t = test as { id: string; title: string; description: string; mode: string; day_count: number; pass_pct: number; max_retakes: number; complete_within_amount: number | null; complete_within_unit: "hours" | "days" };

  const day = Math.min(Math.max(1, a.current_day), t.day_count);
  const [{ data: dayRow }, { data: qRows }] = await Promise.all([
    admin.from("test_days").select("day_number, title, content").eq("test_id", id).eq("day_number", day).maybeSingle(),
    admin.from("test_questions").select("id, day_number, kind, prompt, options").eq("test_id", id).eq("day_number", day).order("sort_order"),
  ]);
  // Answer keys are deliberately NOT selected — scoring happens server-side.
  const questions = ((qRows ?? []) as { id: string; kind: string; prompt: string; options: string[] }[]).map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, options: q.options }));

  return shell(
    <TakeClient
      assignmentId={a.id}
      testId={id}
      title={t.title}
      description={t.description}
      mode={t.mode}
      dayNumber={day}
      dayCount={t.day_count}
      dayTitle={dayRow?.title ?? ""}
      dayContent={dayRow?.content ?? ""}
      questions={questions}
      status={a.status}
      passPct={t.pass_pct}
      lastScore={a.last_score}
      bestScore={a.best_score}
      attemptsUsed={a.attempts_used}
      maxRetakes={t.max_retakes}
      dueLabel={completionWindowLabel(t.complete_within_amount, t.complete_within_unit)}
      lang={profile.language}
    />
  );
}
