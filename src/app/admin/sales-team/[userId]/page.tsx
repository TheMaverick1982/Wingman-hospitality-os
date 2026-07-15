import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { getRepReport } from "@/lib/sales-cert";
import { ReportPanel } from "./report-panel";

export const metadata = { title: "Rep · Sales Team" };

export default async function RepDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await getCurrentProfile();
  const isSuper = profile?.isPlatformAdmin && PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));
  if (!isSuper) redirect("/admin/organizations");

  const admin = createAdminClient();
  const { data: rep } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const repName = (rep as { full_name: string } | null)?.full_name ?? "Rep";

  const { data: attemptRows } = await admin
    .from("sales_cert_attempts")
    .select("id, score_pct, section_scores, passed, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  const attempts = (attemptRows ?? []) as { id: string; score_pct: number | null; section_scores: Record<string, number> | null; passed: boolean | null; completed_at: string | null }[];
  const latest = attempts[0] ?? null;

  const { data: answerRows } = latest
    ? await admin.from("sales_cert_answers").select("kind, section, response_text, ai_score, ai_feedback").eq("attempt_id", latest.id).eq("kind", "roleplay")
    : { data: [] as { kind: string; section: string; response_text: string | null; ai_score: number | null; ai_feedback: string | null }[] };
  const roleplay = (answerRows ?? []) as { section: string; response_text: string | null; ai_score: number | null; ai_feedback: string | null }[];

  const cached = await getRepReport(userId);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/admin/sales-team" className="text-brick font-semibold text-sm">← Sales Team</Link>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink mt-2">{repName}</h1>
        {latest ? (
          <p className="text-sm text-muted mt-0.5">
            Latest: <span className="font-semibold text-ink">{latest.score_pct}%</span>{" "}
            <span className={latest.passed ? "text-[#15803d] font-semibold" : "text-[#b42318] font-semibold"}>{latest.passed ? "Certified" : "Not passed"}</span>
            {" · "}{attempts.length} attempt{attempts.length === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-muted mt-0.5">Hasn&apos;t completed the certification yet.</p>
        )}
      </div>

      <ReportPanel userId={userId} initial={cached?.report ?? null} initialAt={cached?.createdAt ?? null} />

      {latest?.section_scores && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <div className="text-[13px] font-semibold text-ink mb-3">Latest test — by section</div>
          <div className="flex flex-col gap-2.5">
            {Object.entries(latest.section_scores).map(([section, pct]) => (
              <div key={section}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="text-charcoal-2">{section}</span>
                  <span className={`font-semibold tabular-nums ${pct >= 80 ? "text-[#15803d]" : pct >= 60 ? "text-[#b45309]" : "text-[#b42318]"}`}>{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-paper overflow-hidden">
                  <div className={`h-full ${pct >= 80 ? "bg-[#15803d]" : pct >= 60 ? "bg-[#b45309]" : "bg-[#b42318]"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {roleplay.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <div className="text-[13px] font-semibold text-ink mb-3">Roleplay answers (latest)</div>
          <div className="flex flex-col gap-3">
            {roleplay.map((r, i) => (
              <div key={i} className="border border-line rounded-xl p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2">{r.section}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${(r.ai_score ?? 0) >= 80 ? "text-[#15803d]" : (r.ai_score ?? 0) >= 60 ? "text-[#b45309]" : "text-[#b42318]"}`}>{r.ai_score ?? 0}%</span>
                </div>
                {r.response_text && <div className="text-[13.5px] text-charcoal-2 italic">“{r.response_text}”</div>}
                {r.ai_feedback && <div className="text-[13px] text-muted mt-1">{r.ai_feedback}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {attempts.length > 0 && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-line text-[13px] font-semibold text-ink">Attempt history</div>
          <div className="divide-y divide-line">
            {attempts.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.passed ? <CheckCircle2 size={16} className="text-[#15803d]" /> : <XCircle size={16} className="text-[#b42318]" />}
                  <span className="text-sm text-ink font-semibold tabular-nums">{a.score_pct ?? 0}%</span>
                </div>
                <span className="text-[12.5px] text-muted-2">{a.completed_at ? new Date(a.completed_at).toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
