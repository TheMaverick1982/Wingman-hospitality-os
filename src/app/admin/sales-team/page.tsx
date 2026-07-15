import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { CERT_PASS_PCT } from "@/lib/sales-cert";

export const metadata = { title: "Sales Team · Admin" };

const SALES_ACCESS = ["sales_dashboard", "sales_training", "commissions"];

export default async function SalesTeamPage() {
  const profile = await getCurrentProfile();
  const isSuper = profile?.isPlatformAdmin && PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));
  if (!isSuper) redirect("/admin/organizations");

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, platform_access")
    .eq("is_platform_admin", true)
    .order("full_name");
  const reps = ((staff ?? []) as { id: string; full_name: string; platform_access: string[] | null }[]).filter((p) =>
    (p.platform_access ?? []).some((a) => SALES_ACCESS.includes(a)),
  );

  const ids = reps.map((r) => r.id);
  const { data: attempts } = ids.length
    ? await admin.from("sales_cert_attempts").select("user_id, score_pct, passed, completed_at").in("user_id", ids).not("completed_at", "is", null)
    : { data: [] as { user_id: string; score_pct: number | null; passed: boolean | null; completed_at: string | null }[] };

  const byUser = new Map<string, { best: number; attempts: number; passed: boolean; last: string | null }>();
  for (const a of (attempts ?? []) as { user_id: string; score_pct: number | null; passed: boolean | null; completed_at: string | null }[]) {
    const cur = byUser.get(a.user_id) ?? { best: 0, attempts: 0, passed: false, last: null };
    cur.best = Math.max(cur.best, a.score_pct ?? 0);
    cur.attempts += 1;
    cur.passed = cur.passed || Boolean(a.passed);
    if (!cur.last || (a.completed_at && a.completed_at > cur.last)) cur.last = a.completed_at;
    byUser.set(a.user_id, cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center shrink-0"><UserCog size={19} /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Sales Team</h1>
          <p className="text-sm text-muted mt-0.5">Every rep&apos;s certification status. Open one for the full breakdown and an AI coaching report.</p>
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <th className="px-5 py-3">Rep</th>
              <th className="px-5 py-3">Best score</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Attempts</th>
              <th className="px-5 py-3">Last test</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => {
              const s = byUser.get(r.id);
              const status = !s ? "Not started" : s.passed ? "Certified" : "Not passed";
              const tone = !s ? "text-muted-2" : s.passed ? "text-[#15803d]" : "text-[#b42318]";
              return (
                <tr key={r.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-4 font-semibold text-ink">{r.full_name || "—"}</td>
                  <td className="px-5 py-4 text-charcoal-2 tabular-nums">{s ? `${s.best}%` : "—"}</td>
                  <td className={`px-5 py-4 font-semibold ${tone}`}>{status}{s && !s.passed ? ` (<${CERT_PASS_PCT}%)` : ""}</td>
                  <td className="px-5 py-4 text-charcoal-2 tabular-nums">{s?.attempts ?? 0}</td>
                  <td className="px-5 py-4 text-muted-2">{s?.last ? new Date(s.last).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/sales-team/${r.id}`} className="text-sm font-semibold text-brick">View →</Link>
                  </td>
                </tr>
              );
            })}
            {reps.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted">No sales reps yet. Grant a teammate Sales access under Team.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
