import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, TrendingUp, ShieldCheck, AlertTriangle, Library, ArrowRight, CreditCard } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getFranchiseRollup, type FranchiseeMetrics } from "@/lib/franchise";
import { getGroupBillingSummary } from "@/lib/franchise-billing";
import { InviteFranchisee } from "./invite-franchisee";

export const metadata = { title: "Franchise oversight — Wingman" };

const STATUS: Record<FranchiseeMetrics["status"], { label: string; cls: string; dot: string }> = {
  strong: { label: "Strong", cls: "text-[#15803d] bg-[#E7F6EC]", dot: "bg-[#15803d]" },
  ok: { label: "On track", cls: "text-charcoal-2 bg-paper", dot: "bg-muted-2" },
  attention: { label: "Needs attention", cls: "text-[#B45309] bg-gold-tint", dot: "bg-[#B45309]" },
};

export default async function FranchisePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  // Franchisor console — only for franchise admins/viewers.
  if (!profile.franchiseGroupId) redirect("/dashboard");

  const rollup = await getFranchiseRollup(profile.franchiseGroupId);
  if (!rollup) redirect("/dashboard");

  const { group, members, totals } = rollup;
  // Billing visibility is admin-only (viewers see compliance, not money).
  const billing = profile.franchiseRole === "admin" ? await getGroupBillingSummary(profile.franchiseGroupId) : null;
  const billStatus = new Map((billing?.members ?? []).map((m) => [m.orgId, m]));
  const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center shrink-0 mt-0.5">
          <Building2 size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] uppercase text-muted-2 mb-1">
            <ShieldCheck size={13} /> Franchise oversight
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink mb-1">{group.name}</h1>
          <p className="text-base text-muted max-w-2xl">
            How every franchisee is holding the brand standard. Compliance and outcomes only — guest contact details stay
            with each franchisee.
          </p>
        </div>
      </div>

      {profile.franchiseRole === "admin" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/franchise/library"
            className="flex items-center gap-3 bg-white border border-line rounded-2xl px-6 py-4 hover:border-brick transition-colors group shadow-sm"
          >
            <Library size={18} className="text-brick shrink-0" />
            <span className="text-sm text-ink flex-1">
              <span className="font-semibold">Brand Library</span> — push your training to every franchisee, locked or adaptable.
            </span>
            <ArrowRight size={15} className="text-muted-2 group-hover:text-brick transition-colors" />
          </Link>
          <InviteFranchisee />
        </div>
      )}

      {/* Brand-wide rollup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RollupStat label="Franchisees" value={String(totals.franchisees)} sub="in this group" />
        <RollupStat label="Avg repeat rate" value={`${totals.avgRepeatRate}%`} sub="across the brand" icon={<TrendingUp size={14} className="text-olive" />} />
        <RollupStat label="Avg audit health" value={totals.avgAuditHealth != null ? String(totals.avgAuditHealth) : "—"} sub="standout audit" />
        <RollupStat label="Need attention" value={String(totals.needAttention)} sub="slipping this week" tone={totals.needAttention > 0 ? "warn" : undefined} icon={totals.needAttention > 0 ? <AlertTriangle size={14} className="text-[#B45309]" /> : undefined} />
      </div>

      {/* Per-franchisee hit list */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <div className="text-[15px] font-semibold text-ink">Every franchisee</div>
          <div className="text-[12.5px] text-muted-2">Ones needing attention are listed first.</div>
        </div>
        {members.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-2">
            No franchisees in this group yet. Add them from Platform admin → Franchises.
          </div>
        ) : (
          <div className="hidden sm:grid grid-cols-[1.6fr_repeat(4,1fr)_auto] gap-3 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2 border-b border-line">
            <span>Franchisee</span>
            <span className="text-right">Repeat rate</span>
            <span className="text-right">Audit health</span>
            <span className="text-right">Spot-checks 7d</span>
            <span className="text-right">Sign-offs 30d</span>
            <span className="text-right">Status</span>
          </div>
        )}
        <div className="divide-y divide-line">
          {members.map((m) => {
            const s = STATUS[m.status];
            return (
              <div key={m.orgId} className="grid grid-cols-2 sm:grid-cols-[1.6fr_repeat(4,1fr)_auto] gap-x-3 gap-y-1.5 px-6 py-3.5 items-center">
                <div className="col-span-2 sm:col-span-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-ink truncate">{m.name}</div>
                  <div className="text-[12px] text-muted-2 sm:hidden">{m.guestsTracked} guests tracked</div>
                </div>
                <Cell label="Repeat" value={`${m.repeatRate}%`} />
                <Cell label="Audit" value={m.auditHealth != null ? String(m.auditHealth) : "—"} />
                <Cell label="Spot-checks 7d" value={String(m.spotChecks7d)} />
                <Cell label="Sign-offs 30d" value={String(m.signoffs30d)} />
                <div className="col-span-2 sm:col-span-1 sm:text-right">
                  <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing (admin only) */}
      {billing && (
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-brick" />
              <div>
                <div className="text-[15px] font-semibold text-ink">Billing</div>
                <div className="text-[12.5px] text-muted-2">
                  {billing.mode === "central"
                    ? "Franchisor pays for all — one rolled-up charge each month."
                    : "Each franchisee pays their own card. You see status, not their card."}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2">
                {billing.mode === "central" ? "Your monthly charge" : "Combined across the brand"}
              </div>
              <div className="text-[22px] font-bold text-ink tabular-nums leading-tight">{money(billing.totalMonthlyCents)}<span className="text-[12px] font-medium text-muted-2">/mo</span></div>
            </div>
          </div>
          {billing.mode === "central" && !billing.ownerHasCard && (
            <div className="px-6 py-3 bg-gold-tint border-b border-[#F0D9A8] text-[13px] text-[#8a5a00]">
              Add a card on your own <Link href="/settings" className="underline font-semibold">Settings → Billing</Link> to activate the group charge — until then nothing is billed.
            </div>
          )}
          <div className="divide-y divide-line">
            {billing.members.map((m) => {
              const cancel = m.billingStatus === "canceled";
              const past = m.billingStatus === "past_due";
              return (
                <div key={m.orgId} className="flex items-center justify-between gap-3 px-6 py-3">
                  <span className="text-[14px] text-ink truncate">{m.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13.5px] font-semibold text-ink tabular-nums">{m.isFree ? "Free" : `${money(m.monthlyCents)}/mo`}</span>
                    {billing.mode === "distributed" && !m.isFree && (
                      <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full ${past ? "text-[#B42318] bg-[#FDECEA]" : cancel ? "text-muted-2 bg-paper" : "text-[#15803d] bg-[#E7F6EC]"}`}>
                        {past ? "Past due" : cancel ? "Canceling" : "Active"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[12px] text-muted-2">
        Oversight, brand-standard push-down, and group billing. Franchisees keep full control of their own account —
        their guest contact details never leave their org.
      </p>
    </>
  );
}

function RollupStat({ label, value, sub, icon, tone }: { label: string; value: string; sub: string; icon?: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[12.5px] text-muted font-medium">{label}</span>
      </div>
      <div className={`text-[30px] font-bold tracking-[-0.02em] leading-none tabular-nums ${tone === "warn" ? "text-[#B45309]" : "text-ink"}`}>{value}</div>
      <div className="text-[12px] text-muted-2 mt-2">{sub}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <span className="text-[11px] text-muted-2 sm:hidden">{label}: </span>
      <span className="text-[14px] font-semibold text-ink tabular-nums">{value}</span>
    </div>
  );
}
