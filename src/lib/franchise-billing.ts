import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveMonthlyCents } from "@/lib/pricing";

// Franchise Phase 3 — group billing. Distributed groups keep per-org billing;
// central groups roll every franchisee's price into one charge to the group's
// card (held on the group owner's org).

type OrgPricing = {
  id: string;
  name: string;
  is_free_account: boolean;
  billing_status: string;
  custom_monthly_cents: number | null;
  custom_addl_location_cents: number | null;
  plan_first_cents: number | null;
  plan_addl_cents: number | null;
};

const PRICING_COLS = "id, name, is_free_account, billing_status, custom_monthly_cents, custom_addl_location_cents, plan_first_cents, plan_addl_cents";

async function monthlyCentsForOrg(admin: SupabaseClient, org: OrgPricing): Promise<number> {
  if (org.is_free_account) return 0;
  const { count } = await admin.from("locations").select("id", { count: "exact", head: true }).eq("org_id", org.id);
  return effectiveMonthlyCents(org, count ?? 1);
}

export type GroupBillingSummary = {
  groupId: string;
  mode: "central" | "distributed";
  ownerOrgId: string | null;
  ownerHasCard: boolean;
  members: { orgId: string; name: string; billingStatus: string; monthlyCents: number; isFree: boolean }[];
  totalMonthlyCents: number;
};

export async function getGroupBillingSummary(groupId: string): Promise<GroupBillingSummary | null> {
  const admin = createAdminClient();
  const { data: g } = await admin.from("franchise_groups").select("billing_mode, owner_user_id").eq("id", groupId).maybeSingle();
  const group = g as { billing_mode: string; owner_user_id: string | null } | null;
  if (!group) return null;

  const { data: memberRows } = await admin.from("franchise_memberships").select("org_id").eq("group_id", groupId).eq("status", "active");
  const orgIds = ((memberRows ?? []) as { org_id: string }[]).map((m) => m.org_id);

  const members: GroupBillingSummary["members"] = [];
  let total = 0;
  for (const orgId of orgIds) {
    const { data: o } = await admin.from("organizations").select(PRICING_COLS).eq("id", orgId).maybeSingle();
    const org = o as OrgPricing | null;
    if (!org) continue;
    const cents = await monthlyCentsForOrg(admin, org);
    total += cents;
    members.push({ orgId, name: org.name, billingStatus: org.billing_status, monthlyCents: cents, isFree: org.is_free_account });
  }

  // The group's card lives on the owner's org.
  let ownerOrgId: string | null = null;
  let ownerHasCard = false;
  if (group.owner_user_id) {
    const { data: prof } = await admin.from("profiles").select("org_id").eq("id", group.owner_user_id).maybeSingle();
    ownerOrgId = (prof as { org_id: string } | null)?.org_id ?? null;
    if (ownerOrgId) {
      const { data: pm } = await admin.from("billing_payment_methods").select("org_id").eq("org_id", ownerOrgId).maybeSingle();
      ownerHasCard = Boolean(pm);
    }
  }

  return {
    groupId,
    mode: group.billing_mode === "central" ? "central" : "distributed",
    ownerOrgId,
    ownerHasCard,
    members: members.sort((a, b) => b.monthlyCents - a.monthlyCents),
    totalMonthlyCents: total,
  };
}

// Set the group's billing mode and keep every member org's billed_by_group flag
// in sync (central → true; distributed → false).
export async function setGroupBillingMode(groupId: string, mode: "central" | "distributed"): Promise<void> {
  const admin = createAdminClient();
  await admin.from("franchise_groups").update({ billing_mode: mode }).eq("id", groupId);
  const { data: memberRows } = await admin.from("franchise_memberships").select("org_id").eq("group_id", groupId);
  const orgIds = ((memberRows ?? []) as { org_id: string }[]).map((m) => m.org_id);
  if (orgIds.length) await admin.from("organizations").update({ billed_by_group: mode === "central" }).in("id", orgIds);
}

// Apply a group's billing mode to one org when it joins/leaves.
export async function applyGroupBillingToOrg(admin: SupabaseClient, groupId: string, orgId: string): Promise<void> {
  const { data: g } = await admin.from("franchise_groups").select("billing_mode").eq("id", groupId).maybeSingle();
  const central = (g as { billing_mode: string } | null)?.billing_mode === "central";
  await admin.from("organizations").update({ billed_by_group: central }).eq("id", orgId);
}
