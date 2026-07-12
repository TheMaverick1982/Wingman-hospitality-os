import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents, formatDate, isDue, totalsFor, type SalesCommission } from "@/lib/sales-commissions";
import { CommissionForm } from "./commission-form";
import { PayableDate } from "./payable-date";
import { markPaid, markOwed, voidCommission, deleteCommission, markAllPaidForRep, approveCommission, denyCommission } from "./actions";

export const metadata: Metadata = { title: "Sales Commissions · Admin" };

const KIND_LABEL: Record<string, string> = { activation: "Activation", tail: "Tail", other: "Other" };
const STATUS_STYLE: Record<string, string> = {
  pending: "text-[#B45309] bg-gold-tint",
  owed: "text-[#B45309] bg-gold-tint",
  paid: "text-olive bg-olive-tint",
  denied: "text-muted bg-paper",
  void: "text-muted bg-paper line-through",
};
const STATUS_LABEL: Record<string, string> = { pending: "Pending", owed: "Owed", paid: "Paid", denied: "Denied", void: "Void" };

export default async function SalesCommissionsPage() {
  await requirePlatformSection("commissions");
  const admin = createAdminClient();

  const [{ data: staff }, { data: orgs }, { data: commissions }] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("is_platform_admin", true).order("full_name"),
    admin.from("organizations").select("id, name").order("name"),
    admin
      .from("sales_commissions")
      .select("id, rep_profile_id, org_id, kind, label, amount_cents, status, note, created_at, paid_at, payable_on")
      .order("created_at", { ascending: false }),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const reps = ((staff ?? []) as { id: string; full_name: string | null }[]).map((r) => ({ id: r.id, name: r.full_name || "(unnamed)" }));
  const orgList = ((orgs ?? []) as { id: string; name: string }[]);
  const orgName = new Map(orgList.map((o) => [o.id, o.name]));
  const repName = new Map(reps.map((r) => [r.id, r.name]));
  const rows = (commissions ?? []) as SalesCommission[];

  // Rep-submitted claims awaiting the owner's approve/deny decision.
  const pendingRows = rows.filter((r) => r.status === "pending");
  const ledgerRows = rows.filter((r) => r.status !== "pending");

  // Group the decided rows by rep, keeping the newest-first order within each.
  const byRep = new Map<string, SalesCommission[]>();
  for (const row of ledgerRows) {
    const arr = byRep.get(row.rep_profile_id) ?? [];
    arr.push(row);
    byRep.set(row.rep_profile_id, arr);
  }
  // Reps with any activity, most recently active first.
  const activeRepIds = [...byRep.keys()].sort((a, b) => {
    const aT = byRep.get(a)![0]?.created_at ?? "";
    const bT = byRep.get(b)![0]?.created_at ?? "";
    return bT.localeCompare(aT);
  });

  const grandOwed = totalsFor(rows).owedCents;

  // "Due now" = approved (owed) commissions whose expected pay date has arrived.
  const dueRows = ledgerRows.filter((r) => r.status === "owed" && isDue(r.payable_on, todayIso));
  const dueTotal = dueRows.reduce((t, r) => t + r.amount_cents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Sales Commissions</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Record what each rep earned and mark it paid. Reps see their own balance in the Sales Training section, so the
          numbers always match. Standard plan: $125 per location activated + 5% of monthly revenue for six months.
        </p>
      </div>

      {grandOwed > 0 && (
        <div className="bg-gold-tint border border-[#F0D9A8] rounded-2xl px-6 py-4">
          <span className="text-[13px] font-semibold text-[#B45309]">Total owed across all reps: </span>
          <span className="text-[15px] font-bold text-[#B45309] tabular-nums">{formatCents(grandOwed)}</span>
        </div>
      )}

      {dueRows.length > 0 && (
        <div className="bg-olive-tint border-2 border-olive/30 rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="text-[16px] font-bold text-olive">Due to pay now · {formatCents(dueTotal)}</div>
              <div className="text-[13px] text-[#166534] mt-0.5">{dueRows.length} commission{dueRows.length === 1 ? "" : "s"} past their expected pay date and still owed.</div>
            </div>
          </div>
          <div className="bg-white/60 border-t border-olive/20">
            {dueRows.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-olive/10 last:border-0 text-[13.5px]">
                <span className="text-charcoal-2 truncate">
                  <span className="font-semibold text-ink">{repName.get(c.rep_profile_id) ?? "?"}</span> · {c.label}
                  <span className="text-muted-2"> · was due {formatDate(c.payable_on)}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-ink tabular-nums">{formatCents(c.amount_cents)}</span>
                  <form action={markPaid}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-[12.5px] font-semibold text-white bg-olive rounded-full px-3.5 py-1 hover:opacity-90 transition-opacity">Mark paid</button>
                  </form>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingRows.length > 0 && (
        <div className="bg-white border-2 border-[#F0D9A8] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-line bg-gold-tint">
            <div className="text-[16px] font-bold text-[#B45309]">Pending approval · {pendingRows.length}</div>
            <div className="text-[13px] text-[#B45309]/90 mt-0.5">Claims reps submitted for accounts they closed. Approve to make them owed, or deny.</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {pendingRows.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-ink">{repName.get(c.rep_profile_id) ?? "(unknown rep)"}</div>
                    <div className="text-[13px] text-charcoal-2 mt-0.5">{c.label}</div>
                    <div className="text-[12px] text-muted-2 mt-0.5">
                      {KIND_LABEL[c.kind]}
                      {c.org_id && orgName.get(c.org_id) ? ` · ${orgName.get(c.org_id)}` : ""}
                      {" · "}{new Date(c.created_at).toLocaleDateString()}
                      {c.note ? ` · ${c.note}` : ""}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-ink tabular-nums whitespace-nowrap">{formatCents(c.amount_cents)}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <form action={approveCommission} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-[13px] font-semibold text-white bg-olive rounded-full px-4 py-1.5 hover:opacity-90 transition-opacity">Approve</button>
                    </form>
                    <form action={denyCommission} className="inline ml-2">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-[13px] font-semibold text-charcoal-2 hover:text-brick px-2">Deny</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CommissionForm reps={reps} orgs={orgList} />

      {activeRepIds.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No commissions recorded yet. Add one above.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {activeRepIds.map((repId) => {
            const repRows = byRep.get(repId)!;
            const { owedCents, paidCents } = totalsFor(repRows);
            return (
              <div key={repId} className="bg-white border border-line rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line bg-paper">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[16px] font-bold text-ink">{repName.get(repId) ?? "(unknown rep)"}</span>
                    <span className="text-[13px] text-muted">
                      Owed <span className="font-semibold text-[#B45309] tabular-nums">{formatCents(owedCents)}</span>
                      {" · "}Paid <span className="font-semibold text-olive tabular-nums">{formatCents(paidCents)}</span>
                    </span>
                  </div>
                  {owedCents > 0 && (
                    <form action={markAllPaidForRep}>
                      <input type="hidden" name="rep_profile_id" value={repId} />
                      <button type="submit" className="text-[13px] font-semibold text-white bg-olive rounded-full px-4 py-1.5 hover:opacity-90 transition-opacity">
                        Mark all owed paid
                      </button>
                    </form>
                  )}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {repRows.map((c) => (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-ink">{c.label}</div>
                          <div className="text-[12px] text-muted-2 mt-0.5">
                            {KIND_LABEL[c.kind]}
                            {c.org_id && orgName.get(c.org_id) ? ` · ${orgName.get(c.org_id)}` : ""}
                            {" · "}{new Date(c.created_at).toLocaleDateString()}
                            {c.note ? ` · ${c.note}` : ""}
                          </div>
                          {c.status === "owed" ? (
                            <div className="mt-1.5">
                              <PayableDate id={c.id} value={c.payable_on} due={isDue(c.payable_on, todayIso)} />
                            </div>
                          ) : c.status === "paid" && c.paid_at ? (
                            <div className="text-[12px] text-olive mt-1">Paid {new Date(c.paid_at).toLocaleDateString()}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-ink tabular-nums whitespace-nowrap">{formatCents(c.amount_cents)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {c.status === "owed" && (
                            <form action={markPaid} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="text-[13px] font-semibold text-olive hover:opacity-80 px-2">Mark paid</button>
                            </form>
                          )}
                          {c.status === "paid" && (
                            <form action={markOwed} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="text-[13px] font-semibold text-charcoal-2 hover:text-brick px-2">Unmark</button>
                            </form>
                          )}
                          {c.status === "denied" && (
                            <form action={approveCommission} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="text-[13px] font-semibold text-olive hover:opacity-80 px-2">Approve</button>
                            </form>
                          )}
                          {(c.status === "owed" || c.status === "paid") && (
                            <form action={voidCommission} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-brick px-2">Void</button>
                            </form>
                          )}
                          <form action={deleteCommission} className="inline">
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger px-2">Delete</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
