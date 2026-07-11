import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { Pill } from "@/components/ui/pill";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { CreateOrgButton } from "./create-org-form";

export default async function AdminOrganizationsPage() {
  await requirePlatformSection("organizations");
  const admin = createAdminClient();

  const [{ data: orgs }, { data: locations }, { data: profiles }, { data: guests }] = await Promise.all([
    // Real customer accounts only — exclude the internal platform org AND all
    // demo orgs (the shared sales demo + auto-created "Try the live demo" sandboxes).
    admin.from("organizations").select("id, name, is_free_account, created_at").eq("is_platform", false).eq("is_demo", false).order("created_at", { ascending: false }),
    admin.from("locations").select("id, org_id"),
    admin.from("profiles").select("id, org_id"),
    admin.from("guests").select("id, org_id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
  ]);

  const locationCountByOrg = new Map<string, number>();
  for (const l of locations ?? []) locationCountByOrg.set(l.org_id, (locationCountByOrg.get(l.org_id) ?? 0) + 1);

  const teamCountByOrg = new Map<string, number>();
  for (const p of profiles ?? []) teamCountByOrg.set(p.org_id, (teamCountByOrg.get(p.org_id) ?? 0) + 1);

  const guestsByOrg = new Map<string, GuestWithVisits[]>();
  for (const g of (guests ?? []) as (GuestWithVisits & { org_id: string })[]) {
    const list = guestsByOrg.get(g.org_id) ?? [];
    list.push(g);
    guestsByOrg.set(g.org_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Organizations</h1>
          <p className="text-sm text-muted mt-1">Every Wingman account, across every organization.</p>
        </div>
        <CreateOrgButton />
      </div>

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
              return (
                <tr key={org.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-4 font-semibold text-ink">
                    <div className="flex items-center gap-2">
                      {org.name}
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
