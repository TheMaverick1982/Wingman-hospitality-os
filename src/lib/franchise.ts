import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStageCounts, type GuestWithVisits } from "@/lib/hospitality";

// Franchise / multi-org helpers (Phase 1). All reads go through the service-role
// client after an app-level check. Franchisors see COMPLIANCE + AGGREGATES only
// — never raw guest contact info (that stays with the franchisee owner).

export type FranchiseGroup = { id: string; name: string; billingMode: string };

export type FranchiseContext = { group: FranchiseGroup; role: "admin" | "viewer" } | null;

const DAY = 86400000;

// Is the current user a franchise admin? Returns their group + role, or null.
// Guarded so a pre-migration environment can't break auth/nav.
export async function getFranchiseContextForUser(userId: string): Promise<FranchiseContext> {
  try {
    const admin = createAdminClient();
    const { data: adminRow } = await admin
      .from("franchise_admins")
      .select("group_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    const row = adminRow as { group_id: string; role: "admin" | "viewer" } | null;
    if (!row) return null;
    const { data: g } = await admin.from("franchise_groups").select("id, name, billing_mode").eq("id", row.group_id).maybeSingle();
    const group = g as { id: string; name: string; billing_mode: string } | null;
    if (!group) return null;
    return { group: { id: group.id, name: group.name, billingMode: group.billing_mode }, role: row.role };
  } catch {
    return null;
  }
}

export type FranchiseeMetrics = {
  orgId: string;
  name: string;
  guestsTracked: number;
  repeatRate: number; // %
  spotChecks7d: number;
  signoffs30d: number;
  auditHealth: number | null;
  // A blunt "are they running the plays?" signal from the above.
  status: "strong" | "ok" | "attention";
};

export type FranchiseRollup = {
  group: FranchiseGroup;
  members: FranchiseeMetrics[];
  totals: { franchisees: number; avgRepeatRate: number; avgAuditHealth: number | null; needAttention: number };
};

function statusFor(m: Omit<FranchiseeMetrics, "status">): FranchiseeMetrics["status"] {
  // Simple, transparent rule: healthy audit + some floor activity = strong;
  // clearly inactive or low audit = needs attention.
  const inactive = m.spotChecks7d === 0 && m.signoffs30d === 0;
  if ((m.auditHealth ?? 0) >= 75 && !inactive) return "strong";
  if (inactive || (m.auditHealth ?? 100) < 50) return "attention";
  return "ok";
}

// Per-franchisee compliance metrics for the franchisor console. No guest PII —
// only counts and rates.
async function metricsForOrg(admin: ReturnType<typeof createAdminClient>, orgId: string, name: string): Promise<FranchiseeMetrics> {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [{ data: guests }, { count: spot }, { count: signoffs }, { data: auditRow }] = await Promise.all([
    admin.from("guests").select("id, guest_visits(visit_number, visit_date)").eq("org_id", orgId),
    admin.from("spot_checks").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since7),
    admin.from("training_signoffs").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since30),
    admin.from("audits").select("health_score").eq("org_id", orgId).order("occurred_on", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const guestRows = (guests ?? []) as GuestWithVisits[];
  const stage = computeStageCounts(guestRows);
  const auditHealth = (auditRow as { health_score: number } | null)?.health_score ?? null;

  const base = {
    orgId,
    name,
    guestsTracked: stage.total,
    repeatRate: stage.pct[1] || 0,
    spotChecks7d: spot ?? 0,
    signoffs30d: signoffs ?? 0,
    auditHealth,
  };
  return { ...base, status: statusFor(base) };
}

export async function getFranchiseRollup(groupId: string): Promise<FranchiseRollup | null> {
  const admin = createAdminClient();
  const { data: g } = await admin.from("franchise_groups").select("id, name, billing_mode").eq("id", groupId).maybeSingle();
  const group = g as { id: string; name: string; billing_mode: string } | null;
  if (!group) return null;

  const { data: memberRows } = await admin
    .from("franchise_memberships")
    .select("org_id, organizations(name)")
    .eq("group_id", groupId)
    .eq("status", "active");
  const members = (memberRows ?? []) as unknown as { org_id: string; organizations: { name: string } | null }[];

  const metrics = await Promise.all(members.map((m) => metricsForOrg(admin, m.org_id, m.organizations?.name ?? "Unnamed")));
  metrics.sort((a, b) => (a.status === b.status ? b.repeatRate - a.repeatRate : rank(a.status) - rank(b.status)));

  const withAudit = metrics.filter((m) => m.auditHealth != null);
  const totals = {
    franchisees: metrics.length,
    avgRepeatRate: metrics.length ? Math.round(metrics.reduce((s, m) => s + m.repeatRate, 0) / metrics.length) : 0,
    avgAuditHealth: withAudit.length ? Math.round(withAudit.reduce((s, m) => s + (m.auditHealth ?? 0), 0) / withAudit.length) : null,
    needAttention: metrics.filter((m) => m.status === "attention").length,
  };

  return { group: { id: group.id, name: group.name, billingMode: group.billing_mode }, members: metrics, totals };
}

// Sort so "attention" floats to the top of the hit list.
function rank(s: FranchiseeMetrics["status"]): number {
  return s === "attention" ? 0 : s === "ok" ? 1 : 2;
}
