import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { getActiveCertVersion } from "@/lib/sales-cert";

export const metadata = { title: "Answer key · Sales Team" };
export const maxDuration = 60;

export default async function AnswerKeyPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await getCurrentProfile();
  const isSuper = profile?.isPlatformAdmin && PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));
  if (!isSuper) redirect("/admin/organizations");

  const admin = createAdminClient();
  const { data: rep } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const repName = (rep as { full_name: string } | null)?.full_name ?? "Rep";

  // Use the version the rep last tested on so the key matches their attempt.
  // Fall back to the current active version if they've never completed one.
  const { data: latest } = await admin
    .from("sales_cert_attempts")
    .select("version_id, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let versionId = (latest as { version_id: string } | null)?.version_id ?? null;
  const matchesAttempt = Boolean(versionId);
  if (!versionId) {
    const { version } = await getActiveCertVersion();
    versionId = version?.id ?? null;
  }

  const { data: qRows } = versionId
    ? await admin.from("sales_cert_questions").select("section, kind, prompt, options, correct_index, explanation, sort_order").eq("version_id", versionId).order("sort_order")
    : { data: [] as { section: string; kind: string; prompt: string; options: string[]; correct_index: number | null; explanation: string }[] };
  const questions = (qRows ?? []) as { section: string; kind: string; prompt: string; options: string[]; correct_index: number | null; explanation: string }[];
  const mcq = questions.filter((q) => q.kind === "mcq");
  const roleplay = questions.filter((q) => q.kind === "roleplay");

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <Link href={`/admin/sales-team/${userId}`} className="text-brick font-semibold text-sm">← {repName}</Link>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink mt-2">Answer key</h1>
        <p className="text-sm text-muted mt-0.5">
          {matchesAttempt ? "The exact test this rep took, with correct answers." : "The current test version (this rep hasn't completed one yet)."} For coaching only — don&apos;t share with reps.
        </p>
      </div>

      {questions.length === 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 text-sm text-muted">No test questions to show yet.</div>
      )}

      {mcq.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-brick">Knowledge ({mcq.length})</div>
          {mcq.map((q, i) => (
            <div key={i} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1">{q.section}</div>
              <div className="text-[15px] font-semibold text-ink mb-2.5">{i + 1}. {q.prompt}</div>
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt, oi) => {
                  const correct = oi === q.correct_index;
                  return (
                    <div key={oi} className={`flex items-start gap-2 text-[14px] rounded-lg px-3 py-2 ${correct ? "bg-olive-tint text-ink font-medium" : "text-charcoal-2"}`}>
                      {correct ? <CheckCircle2 size={15} className="text-[#15803d] mt-0.5 shrink-0" /> : <span className="w-[15px] shrink-0" />}
                      {opt}
                    </div>
                  );
                })}
              </div>
              {q.explanation && <div className="text-[13px] text-muted mt-2 border-t border-[#F5F5F5] pt-2"><span className="font-semibold text-brick">Why: </span>{q.explanation}</div>}
            </div>
          ))}
        </div>
      )}

      {roleplay.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-brick flex items-center gap-1.5"><MessageSquare size={13} /> Roleplay ({roleplay.length})</div>
          {roleplay.map((q, i) => (
            <div key={i} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1">{q.section}</div>
              <div className="text-[14px] text-charcoal-2 italic">“{q.prompt}”</div>
              <div className="text-[12.5px] text-muted mt-2">No single right answer — the AI grades technique (calm, curious, value-led, not pushy) for this section. Use the rep&apos;s response + AI feedback on their results page to coach.</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
