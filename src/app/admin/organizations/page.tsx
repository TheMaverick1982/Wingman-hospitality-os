import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { Pill } from "@/components/ui/pill";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { CreateOrgButton } from "./create-org-form";

export default async function AdminOrganizationsPage() {
  const profile = await requirePlatformSection("organizations");
  // Company-wide totals (incl. revenue) are for the top-level owner only — a
  // platform admin with access to every section.
  const isSuperPlatformAdmin = profile.isPlatformAdmin && PLATFORM_SECTIONS.every((s) => profile.platformAccess.includes(s.key));
  const admin = createAdminClient();

  const [{ data: orgs }, { data: locations }, { data: profiles }, { data: guests }, { data: groups }, { data: charges }] = await Promise.all([
    // Real customer accounts only — exclude the internal platform org AND all
    // demo orgs (the shared sales demo + auto-created "Try the live demo" sandboxes).
    admin.from("organizations").select("id, name, is_free_account, franchise_group_id, created_at").eq("is_platform", false).eq("is_demo", false).order("created_at", { ascending: false }),
    admin.from("locations").select("id, org_id"),
    admin.from("profiles").select("id, org_id"),
    admin.from("guests").select("id, org_id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
    admin.from("franchise_groups").select("id, owner_user_id, archived_at"),
    // Total revenue processed — only fetched for the owner view.
    isSuperPlatformAdmin ? admin.from("billing_charges").select("amount_cents").eq("approved", true) : Promise.resolve({ data: [] as { amount_cents: number }[] }),
  ]);

  const realOrgIds = new Set((orgs ?? []).map((o) => o.id));

  const locationCountByOrg = new Map<string, number>();
  let totalLocations = 0;
  for (const l of locations ?? []) {
    locationCountByOrg.set(l.org_id, (locationCountByOrg.get(l.org_id) ?? 0) + 1);
    if (realOrgIds.has(l.org_id)) totalLocations += 1;
  }

  const teamCountByOrg = new Map<string, number>();
  for (const p of profiles ?? []) teamCountByOrg.set(p.org_id, (teamCountByOrg.get(p.org_id) ?? 0) + 1);

  const guestsByOrg = new Map<string, GuestWithVisits[]>();
  const allRealGuests: GuestWithVisits[] = [];
  for (const g of (guests ?? []) as (GuestWithVisits & { org_id: string })[]) {
    const list = guestsByOrg.get(g.org_id) ?? [];
    list.push(g);
    guestsByOrg.set(g.org_id, list);
    if (realOrgIds.has(g.org_id)) allRealGuests.push(g);
  }

  // Franchisor HQ orgs = the org of each group's owner. Everything else with a
  // franchise_group_id is a franchisee.
  const ownerByUser = new Map<string, string>(); // user_id -> org_id
  for (const p of (profiles ?? []) as { id: string; org_id: string }[]) ownerByUser.set(p.id, p.org_id);
  const franchisorOrgIds = new Set<string>();
  for (const g of (groups ?? []) as { owner_user_id: string | null }[]) {
    if (g.owner_user_id && ownerByUser.has(g.owner_user_id)) franchisorOrgIds.add(ownerByUser.get(g.owner_user_id)!);
  }

  // Owner-only totals.
  const totalClients = (orgs ?? []).length;
  const aggregateRepeat = computeRepeatRate(allRealGuests, null);
  const totalRevenueCents = ((charges ?? []) as { amount_cents: number }[]).reduce((s, c) => s + (c.amount_cents ?? 0), 0);
  const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Organizations</h1>
          <p className="text-sm text-muted mt-1">Every Wingman account, across every organization.</p>
        </div>
        <CreateOrgButton />
      </div>

      {/* Owner-only company scoreboard */}
      {isSuperPlatformAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ScoreCard label="Clients" value={totalClients.toLocaleString()} sub="active accounts" />
          <ScoreCard label="Locations" value={totalLocations.toLocaleString()} sub="across all clients" />
          <ScoreCard label="Revenue processed" value={money(totalRevenueCents)} sub="collected to date" />
          <ScoreCard label="Repeat rate" value={`${aggregateRepeat}%`} sub="guests who came back" highlight />
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <th className="px-5 py-3">Organization</th>
              <th className="px-5 py-3">Locations</th>
              <th className="px-5 py-3">Team members</th>
              <th className="px-5 py-3">Repeat rate</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((org) => {
              const repeatRate = computeRepeatRate(guestsByOrg.get(org.id) ?? [], null);
              const isFranchisor = franchisorOrgIds.has(org.id);
              const isFranchisee = !isFranchisor && Boolean(org.franchise_group_id);
              return (
                <tr key={org.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-4 font-semibold text-ink">
                    <div className="flex items-center gap-2 flex-wrap">
                      {org.name}
                      {isFranchisor && <Pill tone="brick">Franchisor</Pill>}
                      {isFranchisee && <Pill tone="muted">Franchisee</Pill>}
                      {org.is_free_account && <Pill tone="olive">Free</Pill>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-charcoal-2">{locationCountByOrg.get(org.id) ?? 0}</td>
                  <td className="px-5 py-4 text-charcoal-2">{teamCountByOrg.get(org.id) ?? 0}</td>
                  <td className="px-5 py-4 text-charcoal-2">{repeatRate}%</td>
                  <td className="px-5 py-4 text-muted-2">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/organizations/${org.id}`} className="text-sm font-semibold text-brick">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(orgs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border shadow-sm ${highlight ? "border-brick/30 bg-brick-tint" : "border-line bg-white"}`}>
      <div className="text-[12.5px] text-muted font-medium">{label}</div>
      <div className={`text-[30px] font-bold tracking-[-0.02em] leading-none tabular-nums mt-2 ${highlight ? "text-brick" : "text-ink"}`}>{value}</div>
      <div className="text-[12px] text-muted-2 mt-2">{sub}</div>
    </div>
  );
}
