import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { aiCostUsd } from "@/lib/ai/usage";

type Admin = ReturnType<typeof createAdminClient>;

export type AiUsageRow = {
  orgId: string | null;
  orgName: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type AiUsageSummary = {
  // Whole-history totals.
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  // Rolling 30-day totals, for "recent burn".
  last30: { calls: number; costUsd: number };
  // Per-client (and one platform/internal) breakdown, most expensive first.
  byOrg: AiUsageRow[];
  // True if we hit the row cap and the numbers understate reality.
  truncated: boolean;
};

const ROW_CAP = 100_000;

// Read the AI-usage ledger with the service-role client and roll it up into an
// overall + per-client cost summary. The ledger is append-only and small at
// current scale, so we aggregate in JS rather than via an RPC. org_id null rows
// are Wingman's own internal calls (social generation, the public sales chat).
export async function getAiUsageSummary(admin: Admin, nowIso: string): Promise<AiUsageSummary> {
  const empty: AiUsageSummary = {
    total: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    last30: { calls: 0, costUsd: 0 },
    byOrg: [],
    truncated: false,
  };

  const { data: rows } = await admin
    .from("ai_usage_events")
    .select("org_id, model, input_tokens, output_tokens, created_at")
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);
  const events = (rows ?? []) as {
    org_id: string | null;
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    created_at: string;
  }[];
  if (events.length === 0) return empty;

  const cutoff = new Date(nowIso).getTime() - 30 * 24 * 60 * 60 * 1000;

  const byOrg = new Map<string, { orgId: string | null; calls: number; input: number; output: number; cost: number }>();
  const total = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const last30 = { calls: 0, costUsd: 0 };

  for (const e of events) {
    const input = e.input_tokens ?? 0;
    const output = e.output_tokens ?? 0;
    const cost = aiCostUsd(e.model, input, output);
    const key = e.org_id ?? "__internal__";
    const bucket = byOrg.get(key) ?? { orgId: e.org_id, calls: 0, input: 0, output: 0, cost: 0 };
    bucket.calls += 1;
    bucket.input += input;
    bucket.output += output;
    bucket.cost += cost;
    byOrg.set(key, bucket);

    total.calls += 1;
    total.inputTokens += input;
    total.outputTokens += output;
    total.costUsd += cost;

    if (new Date(e.created_at).getTime() >= cutoff) {
      last30.calls += 1;
      last30.costUsd += cost;
    }
  }

  // Resolve org names for the client rows (skip the internal bucket).
  const orgIds = [...byOrg.values()].map((b) => b.orgId).filter((id): id is string => Boolean(id));
  const names = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin.from("organizations").select("id, name").in("id", orgIds);
    for (const o of (orgs ?? []) as { id: string; name: string | null }[]) {
      names.set(o.id, o.name ?? "Unnamed org");
    }
  }

  const rowsOut: AiUsageRow[] = [...byOrg.values()].map((b) => ({
    orgId: b.orgId,
    orgName: b.orgId ? names.get(b.orgId) ?? "Deleted org" : "Wingman internal (social, sales chat)",
    calls: b.calls,
    inputTokens: b.input,
    outputTokens: b.output,
    costUsd: b.cost,
  }));
  rowsOut.sort((a, b) => b.costUsd - a.costUsd);

  return { total, last30, byOrg: rowsOut, truncated: events.length >= ROW_CAP };
}
