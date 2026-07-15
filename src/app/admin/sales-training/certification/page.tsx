import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, ArrowRight, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { CERT_PASS_PCT } from "@/lib/sales-cert";

export const metadata = { title: "Sales certification · Admin" };

export default async function CertificationPage() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: attempts } = await admin
    .from("sales_cert_attempts")
    .select("id, score_pct, passed, completed_at")
    .eq("user_id", profile.userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(10);
  const rows = (attempts ?? []) as { id: string; score_pct: number | null; passed: boolean | null; completed_at: string | null }[];
  const best = rows.reduce((m, r) => Math.max(m, r.score_pct ?? 0), 0);
  const everPassed = rows.some((r) => r.passed);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center shrink-0 mt-0.5">
          <GraduationCap size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Sales certification</h1>
          <p className="text-sm text-muted mt-1 max-w-xl">
            Review the playbook, then prove it. The test is generated from the current training content and includes
            live roleplay the AI grades. You need {CERT_PASS_PCT}% to pass.
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Best score" value={`${best}%`} />
          <Stat label="Attempts" value={String(rows.length)} />
          <Stat label="Status" value={everPassed ? "Certified" : "Not yet"} tone={everPassed ? "good" : "warn"} />
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <BookOpen size={18} className="text-brick shrink-0 mt-0.5" />
          <div className="text-sm text-charcoal-2">
            <span className="font-semibold text-ink">Step 1 — Review.</span> Read the full playbook in{" "}
            <Link href="/admin/sales-training" className="text-brick font-semibold underline">Sales Training</Link>. The test only asks what&apos;s in there.
          </div>
        </div>
        <div className="flex items-start gap-3">
          <GraduationCap size={18} className="text-brick shrink-0 mt-0.5" />
          <div className="text-sm text-charcoal-2">
            <span className="font-semibold text-ink">Step 2 — Take the test.</span> Multiple-choice across every section, plus a few roleplay prompts where you respond and the AI coaches you.
          </div>
        </div>
        <Link
          href="/admin/sales-training/certification/take"
          className="self-start inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
        >
          {rows.length > 0 ? "Retake the test" : "Start the test"} <ArrowRight size={15} />
        </Link>
      </div>

      {rows.length > 0 && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-line text-[13px] font-semibold text-ink">Your attempts</div>
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {r.passed ? <CheckCircle2 size={16} className="text-[#15803d]" /> : <XCircle size={16} className="text-[#b42318]" />}
                  <span className="text-sm text-ink font-semibold tabular-nums">{r.score_pct ?? 0}%</span>
                  <span className={`text-[12px] font-semibold ${r.passed ? "text-[#15803d]" : "text-[#b42318]"}`}>{r.passed ? "Passed" : "Not passed"}</span>
                </div>
                <span className="text-[12.5px] text-muted-2">{r.completed_at ? new Date(r.completed_at).toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
      <div className="text-[12px] text-muted font-medium">{label}</div>
      <div className={`text-[24px] font-bold tracking-[-0.02em] mt-1 ${tone === "good" ? "text-[#15803d]" : tone === "warn" ? "text-[#b45309]" : "text-ink"}`}>{value}</div>
    </div>
  );
}
