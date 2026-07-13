import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
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
  created_at: string;
};

export default async function TestsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);

  const supabase = await createClient();
  const [{ data: tests }, { data: meta }, { data: qCounts }] = await Promise.all([
    supabase.from("tests").select("id, title, description, mode, target_departments, day_count, pass_pct, rotates_monthly, created_at").order("created_at", { ascending: false }),
    supabase.from("department_meta").select("department"),
    supabase.from("test_questions").select("test_id"),
  ]);

  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));
  const questionCount = new Map<string, number>();
  for (const r of (qCounts ?? []) as { test_id: string }[]) questionCount.set(r.test_id, (questionCount.get(r.test_id) ?? 0) + 1);

  const rows = ((tests ?? []) as TestRow[]).map((t) => ({ ...t, questions: questionCount.get(t.id) ?? 0 }));

  return (
    <>
      <div>
        <Link href="/training" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors mb-3">
          <ArrowLeft size={14} /> Back to Training
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Tests &amp; exams</h1>
            <p className="text-base text-muted max-w-xl">
              Build a test the same way you build training — let AI write it, or paste what you have and AI makes it better.
              Score it automatically, and (next) assign it to your team.
            </p>
          </div>
        </div>
      </div>

      <TestsClient
        tests={rows}
        activeDepartments={activeDepts as Department[]}
        canEdit={canEdit}
      />
    </>
  );
}
