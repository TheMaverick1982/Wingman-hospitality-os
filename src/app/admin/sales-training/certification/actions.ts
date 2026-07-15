"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeRoleplay, CERT_PASS_PCT } from "@/lib/sales-cert";

export type SubmittedAnswer = { questionId: string; selectedIndex?: number | null; responseText?: string };
export type CertResult = {
  scorePct: number;
  passed: boolean;
  sectionScores: { section: string; pct: number }[];
  roleplay: { prompt: string; score: number; feedback: string }[];
  missed: { prompt: string; section: string; correct: string; explanation: string }[];
};

async function repProfile() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) return null;
  return profile;
}

// Grade + record a certification attempt. MCQs are graded locally; roleplay
// answers are graded by the AI. Returns the full result for the summary view.
export async function submitCert(versionId: string, answers: SubmittedAnswer[]): Promise<{ error: string | null; result?: CertResult }> {
  const profile = await repProfile();
  if (!profile) return { error: "Only sales staff can take the certification." };
  if (!versionId) return { error: "Missing test version." };

  const admin = createAdminClient();
  const { data: qRows } = await admin
    .from("sales_cert_questions")
    .select("id, section, kind, prompt, options, correct_index, explanation")
    .eq("version_id", versionId);
  const questions = (qRows ?? []) as {
    id: string; section: string; kind: string; prompt: string; options: string[]; correct_index: number | null; explanation: string;
  }[];
  if (questions.length === 0) return { error: "This test version has no questions." };

  const byId = new Map(questions.map((q) => [q.id, q]));
  const answerByQ = new Map(answers.map((a) => [a.questionId, a]));

  const { data: attempt } = await admin
    .from("sales_cert_attempts")
    .insert({ version_id: versionId, user_id: profile.userId })
    .select("id")
    .single();
  const attemptId = (attempt as { id: string } | null)?.id;
  if (!attemptId) return { error: "Couldn't start the attempt." };

  const answerRows: Record<string, unknown>[] = [];
  const perSection = new Map<string, { sum: number; n: number }>();
  const roleplay: CertResult["roleplay"] = [];
  const missed: CertResult["missed"] = [];

  for (const q of questions) {
    const a = answerByQ.get(q.id);
    let score = 0; // 0-100 for this question
    if (q.kind === "mcq") {
      const sel = a?.selectedIndex ?? null;
      const correct = sel != null && sel === q.correct_index;
      score = correct ? 100 : 0;
      answerRows.push({ attempt_id: attemptId, question_id: q.id, kind: "mcq", section: q.section, selected_index: sel, correct });
      if (!correct) {
        missed.push({ prompt: q.prompt, section: q.section, correct: q.options[q.correct_index ?? 0] ?? "", explanation: q.explanation });
      }
    } else {
      const text = a?.responseText ?? "";
      const graded = await gradeRoleplay(q.prompt, text);
      score = graded.score;
      answerRows.push({ attempt_id: attemptId, question_id: q.id, kind: "roleplay", section: q.section, response_text: text, ai_score: graded.score, ai_feedback: graded.feedback });
      roleplay.push({ prompt: q.prompt, score: graded.score, feedback: graded.feedback });
    }
    const s = perSection.get(q.section) ?? { sum: 0, n: 0 };
    s.sum += score;
    s.n += 1;
    perSection.set(q.section, s);
  }

  if (answerRows.length) await admin.from("sales_cert_answers").insert(answerRows);

  const sectionScores = [...perSection.entries()].map(([section, v]) => ({ section, pct: Math.round(v.sum / Math.max(1, v.n)) }));
  const scorePct = Math.round(sectionScores.reduce((s, x) => s + x.pct, 0) / Math.max(1, sectionScores.length));
  const passed = scorePct >= CERT_PASS_PCT;

  await admin
    .from("sales_cert_attempts")
    .update({ completed_at: new Date().toISOString(), score_pct: scorePct, section_scores: Object.fromEntries(sectionScores.map((s) => [s.section, s.pct])), passed })
    .eq("id", attemptId);

  revalidatePath("/admin/sales-training/certification");
  return { error: null, result: { scorePct, passed, sectionScores, roleplay, missed } };
}
