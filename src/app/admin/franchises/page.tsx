import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupBillingSummary } from "@/lib/franchise-billing";
import { FranchiseAdminClient, type GroupView, type OrgOption, type AdminOption } from "./franchise-admin-client";

export const metadata = { title: "Franchises — Admin" };

export default async function AdminFranchisesPage() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: groups }, { data: memberships }, { data: admins }, { data: orgs }, { data: supers }] = await Promise.all([
    admin.from("franchise_groups").select("id, name, billing_mode").order("created_at", { ascending: false }),
    admin.from("franchise_memberships").select("group_id, org_id, organizations(name)").eq("status", "active"),
    admin.from("franchise_admins").select("group_id, user_id, role, profiles(full_name)"),
    admin.from("organizations").select("id, name, is_demo, franchise_group_id").order("name"),
    admin.from("profiles").select("id, full_name, access_role, organizations(name)").eq("access_role", "super_admin").order("full_name"),
  ]);

  const membersByGroup = new Map<string, { orgId: string; name: string }[]>();
  for (const m of (memberships ?? []) as unknown as { group_id: string; org_id: string; organizations: { name: string } | null }[]) {
    const arr = membersByGroup.get(m.group_id) ?? [];
    arr.push({ orgId: m.org_id, name: m.organizations?.name ?? "Unnamed" });
    membersByGroup.set(m.group_id, arr);
  }
  const adminsByGroup = new Map<string, { userId: string; name: string; role: string }[]>();
  for (const a of (admins ?? []) as unknown as { group_id: string; user_id: string; role: string; profiles: { full_name: string } | null }[]) {
    const arr = adminsByGroup.get(a.group_id) ?? [];
    arr.push({ userId: a.user_id, name: a.profiles?.full_name ?? "Someone", role: a.role });
    adminsByGroup.set(a.group_id, arr);
  }

  const groupRows = (groups ?? []) as { id: string; name: string; billing_mode: string }[];
  const billingByGroup = new Map(
    await Promise.all(groupRows.map(async (g) => [g.id, await getGroupBillingSummary(g.id)] as const)),
  );

  const groupViews: GroupView[] = groupRows.map((g) => {
    const summary = billingByGroup.get(g.id);
    return {
      id: g.id,
      name: g.name,
      billingMode: g.billing_mode,
      members: membersByGroup.get(g.id) ?? [],
      admins: adminsByGroup.get(g.id) ?? [],
      totalMonthlyCents: summary?.totalMonthlyCents ?? 0,
      ownerHasCard: summary?.ownerHasCard ?? false,
    };
  });

  const orgOptions: OrgOption[] = ((orgs ?? []) as { id: string; name: string; is_demo: boolean; franchise_group_id: string | null }[])
    .filter((o) => !o.is_demo)
    .map((o) => ({ id: o.id, name: o.name, inGroup: o.franchise_group_id }));

  const adminOptions: AdminOption[] = ((supers ?? []) as unknown as { id: string; full_name: string; organizations: { name: string } | null }[]).map((p) => ({
    id: p.id,
    name: p.full_name,
    orgName: p.organizations?.name ?? "",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Franchises</h1>
        <p className="text-sm text-muted mt-1">
          Create a franchise group, attach franchisee organizations, and name the franchisor admins who get oversight.
          Franchisees keep full control of their own accounts.
        </p>
      </div>
      <FranchiseAdminClient groups={groupViews} orgOptions={orgOptions} adminOptions={adminOptions} />
    </div>
  );
}
