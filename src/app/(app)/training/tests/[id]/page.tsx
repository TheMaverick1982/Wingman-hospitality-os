import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { ArrowLeft, Users, Eye } from "lucide-react";
import { TestEditor } from "./test-editor";
import type { TestDay, TestQuestion, TestSettings } from "@/lib/tests";

export const maxDuration = 60;

export default async function TestEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);

  const supabase = await createClient();
  const [{ data: test }, { data: days }, { data: questions }, { data: meta }] = await Promise.all([
    supabase.from("tests").select("*").eq("id", id).maybeSingle(),
    supabase.from("test_days").select("id, day_number, title, content").eq("test_id", id).order("day_number"),
    supabase.from("test_questions").select("id, day_number, sort_order, kind, prompt, options, correct_index, explanation").eq("test_id", id).order("day_number").order("sort_order"),
    supabase.from("department_meta").select("department"),
  ]);
  if (!test) notFound();

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
      <div className="flex items-center justify-between gap-3">
        <Link href="/training/tests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors">
          <ArrowLeft size={14} /> All tests
        </Link>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href={`/training/tests/${id}/preview`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
              <Eye size={14} /> Preview
            </Link>
            <Link href={`/training/tests/${id}/assign`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors">
              <Users size={14} /> Assign &amp; results
            </Link>
          </div>
        )}
      </div>

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
