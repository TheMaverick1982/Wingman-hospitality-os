import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { ArrowLeft, Pencil } from "lucide-react";
import { TestPreview, type PreviewDay } from "./preview-client";

// Manager-facing preview: renders the test exactly as a staff member sees it when
// taking it — study content + questions, day by day — without any assignment,
// scoring, or saving. A manager-only "answer key" toggle reveals the correct
// answers, so it's gated to training editors.
export default async function PreviewTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) redirect(`/training/tests/${id}`);

  const supabase = await createClient();
  const [{ data: test }, { data: dayRows }, { data: qRows }] = await Promise.all([
    supabase.from("tests").select("id, title, description, mode, day_count, pass_pct").eq("id", id).maybeSingle(),
    supabase.from("test_days").select("day_number, title, content").eq("test_id", id).order("day_number"),
    supabase.from("test_questions").select("day_number, sort_order, kind, prompt, options, correct_index, explanation").eq("test_id", id).order("day_number").order("sort_order"),
  ]);
  if (!test) notFound();
  const t = test as { id: string; title: string; description: string; mode: string; day_count: number; pass_pct: number };

  const questions = (qRows ?? []) as { day_number: number; kind: string; prompt: string; options: string[]; correct_index: number; explanation: string }[];
  const dayList = (dayRows ?? []) as { day_number: number; title: string; content: string }[];

  // Build one entry per day (1..day_count), even if a day row is missing.
  const days: PreviewDay[] = [];
  for (let d = 1; d <= Math.max(1, t.day_count); d++) {
    const dayRow = dayList.find((x) => x.day_number === d);
    days.push({
      day_number: d,
      title: dayRow?.title ?? "",
      content: dayRow?.content ?? "",
      questions: questions.filter((q) => q.day_number === d).map((q) => ({ kind: q.kind, prompt: q.prompt, options: q.options, correct_index: q.correct_index, explanation: q.explanation })),
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link href={`/training/tests/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors">
          <ArrowLeft size={14} /> Back to test
        </Link>
        <Link href={`/training/tests/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors">
          <Pencil size={13} /> Edit test
        </Link>
      </div>

      <TestPreview title={t.title} description={t.description} mode={t.mode} passPct={t.pass_pct} days={days} />
    </>
  );
}
