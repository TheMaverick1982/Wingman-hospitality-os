import { createAdminClient } from "@/lib/supabase/admin";
import { computeRepeatRate, type GuestWithVisits } from "@/lib/hospitality";
import { StatTile } from "@/components/ui/stat-tile";

export default async function AdminReportingPage() {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: locations }, { data: profiles }, { data: guests }] = await Promise.all([
    admin.from("organizations").select("id, name"),
    admin.from("locations").select("id, org_id"),
    admin.from("profiles").select("id, org_id"),
    admin.from("guests").select("id, org_id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
  ]);

  const guestList = (guests ?? []) as (GuestWithVisits & { org_id: string })[];
  const platformRepeatRate = computeRepeatRate(guestList, null);

  const guestsByOrg = new Map<string, GuestWithVisits[]>();
  for (const g of guestList) {
    const list = guestsByOrg.get(g.org_id) ?? [];
    list.push(g);
    guestsByOrg.set(g.org_id, list);
  }

  const rows = (orgs ?? [])
    .map((org) => ({
      name: org.name,
      guests: guestsByOrg.get(org.id)?.length ?? 0,
      repeatRate: computeRepeatRate(guestsByOrg.get(org.id) ?? [], null),
    }))
    .sort((a, b) => b.guests - a.guests);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Reporting</h1>
        <p className="text-sm text-muted mt-1">Platform-wide totals across every organization.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Organizations" value={(orgs ?? []).length} />
        <StatTile label="Locations" value={(locations ?? []).length} />
        <StatTile label="Team members" value={(profiles ?? []).length} />
        <StatTile label="Blended repeat rate" value={`${platformRepeatRate}%`} />
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <th className="px-5 py-3">Organization</th>
              <th className="px-5 py-3">Guests tracked</th>
              <th className="px-5 py-3">Repeat rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-line last:border-b-0">
                <td className="px-5 py-4 font-semibold text-ink">{r.name}</td>
                <td className="px-5 py-4 text-charcoal-2">{r.guests}</td>
                <td className="px-5 py-4 text-charcoal-2">{r.repeatRate}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-muted">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
