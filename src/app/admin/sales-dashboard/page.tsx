import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { canAccessPlatformSection } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSalesReps, listDemoTargets } from "@/lib/sales-reps";
import { StatTile } from "@/components/ui/stat-tile";
import { DemoLauncher } from "../sales-training/demo-launcher";

export const metadata: Metadata = { title: "Sales Dashboard · Admin" };
// The "Run a live demo" action provisions a fresh private sandbox — give it room.
export const maxDuration = 60;

type ContactRow = { stage: string; assigned_rep_id: string | null };
type Tally = { total: number; newLeads: number; demos: number; won: number; lost: number; past: number };

function tally(contacts: { stage: string }[]): Tally {
  const t: Tally = { total: contacts.length, newLeads: 0, demos: 0, won: 0, lost: 0, past: 0 };
  for (const c of contacts) {
    if (c.stage === "new" || c.stage === "engaged") t.newLeads++;
    else if (c.stage === "demoed" || c.stage === "demo_completed") t.demos++;
    else if (c.stage === "signed_up") t.won++;
    else if (c.stage === "lost") t.lost++;
    else if (c.stage === "past_client") t.past++;
  }
  return t;
}

function winRate(t: Tally): string {
  const decided = t.won + t.lost;
  return decided > 0 ? `${Math.round((t.won / decided) * 100)}%` : "—";
}

export default async function SalesDashboardPage() {
  const me = await requirePlatformSection("sales_dashboard");
  const admin = createAdminClient();
  // Owners (who manage commissions) get the all-reps view; reps see only theirs.
  const canSeeAll = canAccessPlatformSection(me.platformAccess, "commissions");

  const [{ data: mine }, reps, demoTargets] = await Promise.all([
    admin.from("crm_contacts").select("stage, assigned_rep_id").eq("assigned_rep_id", me.userId),
    listSalesReps(),
    listDemoTargets(me.userId),
  ]);
  const myTally = tally((mine ?? []) as ContactRow[]);

  // Admin all-reps breakdown.
  let allRows: ContactRow[] = [];
  if (canSeeAll) {
    const { data } = await admin.from("crm_contacts").select("stage, assigned_rep_id").not("assigned_rep_id", "is", null);
    allRows = (data ?? []) as ContactRow[];
  }
  const repName = new Map(reps.map((r) => [r.id, r.name]));
  const byRep = new Map<string, ContactRow[]>();
  for (const row of allRows) {
    if (!row.assigned_rep_id) continue;
    const arr = byRep.get(row.assigned_rep_id) ?? [];
    arr.push(row);
    byRep.set(row.assigned_rep_id, arr);
  }
  const repRows = [...byRep.entries()]
    .map(([id, rows]) => ({ id, name: repName.get(id) ?? "(unknown rep)", t: tally(rows) }))
    .sort((a, b) => b.t.won - a.t.won || b.t.total - a.t.total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Sales Dashboard</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Your pipeline at a glance — the leads assigned to you and how they&rsquo;re moving. {canSeeAll ? "As an owner you also see every rep below." : "Only you and the owner can see your numbers."}
          </p>
        </div>
        <div className="shrink-0">
          <DemoLauncher targets={demoTargets} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile label="Assigned to you" value={myTally.total} sub="total leads" />
        <StatTile label="New / nurturing" value={myTally.newLeads} sub="working" />
        <StatTile label="Demos" value={myTally.demos} sub="booked + done" />
        <StatTile label="Won" value={myTally.won} sub="signed up" />
        <StatTile label="Lost" value={myTally.lost} sub="dormant" />
        <StatTile label="Win rate" value={winRate(myTally)} sub="won of decided" />
      </div>

      {myTally.past > 0 && (
        <div className="bg-gold-tint border border-[#F0D9A8] rounded-2xl px-6 py-4 text-[13.5px] text-[#B45309]">
          <span className="font-semibold">{myTally.past} past client{myTally.past === 1 ? "" : "s"}</span> in your book — they&rsquo;re in the Reactivation win-back sequence. A personal note from you often beats the automation.
        </div>
      )}

      {myTally.total === 0 && (
        <div className="bg-white border border-line rounded-2xl p-8 text-center text-muted text-sm">
          No leads assigned to you yet. Open a contact in the <Link href="/admin/crm" className="text-brick font-semibold">CRM</Link> and set its sales rep to start tracking your pipeline here.
        </div>
      )}

      {canSeeAll && repRows.length > 0 && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-line bg-paper">
            <span className="text-[16px] font-bold text-ink">All reps</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left bg-[#FAFAFA]">
                  {["Rep", "Assigned", "New", "Demos", "Won", "Lost", "Win rate"].map((h) => (
                    <th key={h} className="px-5 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repRows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F5F5F5] last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                    <td className="px-5 py-3 tabular-nums text-charcoal-2">{r.t.total}</td>
                    <td className="px-5 py-3 tabular-nums text-charcoal-2">{r.t.newLeads}</td>
                    <td className="px-5 py-3 tabular-nums text-charcoal-2">{r.t.demos}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold text-olive">{r.t.won}</td>
                    <td className="px-5 py-3 tabular-nums text-charcoal-2">{r.t.lost}</td>
                    <td className="px-5 py-3 tabular-nums text-ink">{winRate(r.t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
