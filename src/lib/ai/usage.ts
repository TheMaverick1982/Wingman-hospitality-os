import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Per-1M-token pricing (USD) by model. Update alongside Anthropic's price list.
// Sonnet 5 list is $3 / $15; an intro rate of $2 / $10 runs through 2026-08-31.
// We record cost at the *standard* rate so the platform view is conservative
// (never under-reports what a client actually costs at steady state).
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const DEFAULT_PRICE = { input: 3, output: 15 };

/** Dollar cost of a single call given its token counts. */
export function aiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT_PRICE;
  return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
}

type Usage = { input_tokens?: number | null; output_tokens?: number | null } | null | undefined;

/**
 * Record one Anthropic call against the org it was made for. `orgId` null means
 * platform/internal (e.g. Wingman's own social-card generation, not billable to
 * a client). Fire-and-forget in spirit but awaited so it survives serverless
 * teardown; it never throws — a logging failure must not break the AI feature.
 */
export async function recordAiUsage(opts: {
  orgId?: string | null;
  feature: string;
  model: string;
  usage?: Usage;
}): Promise<void> {
  const input = opts.usage?.input_tokens ?? 0;
  const output = opts.usage?.output_tokens ?? 0;
  if (!input && !output) return;
  try {
    const admin = createAdminClient();
    await admin.from("ai_usage_events").insert({
      org_id: opts.orgId ?? null,
      feature: opts.feature,
      model: opts.model,
      input_tokens: input,
      output_tokens: output,
    });
  } catch (e) {
    console.error("[ai-usage] log failed", e);
  }
}
