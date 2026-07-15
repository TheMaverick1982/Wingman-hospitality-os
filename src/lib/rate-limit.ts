import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared fixed-window rate limiter, backed by the rate_limit_consume() SQL
// function (migration 0030). Call it right after authenticating a request.
//
// Design choices:
//   * Fail OPEN. If the limiter itself errors (DB hiccup, missing migration),
//     we let the request through rather than hard-breaking the product. The
//     limiter is abuse protection, not an authorization control -- the real
//     security boundaries (auth, RLS, org scoping) are enforced elsewhere.
//   * Buckets are opaque strings the caller composes, e.g. `ai:${orgId}` or
//     `apiv1:${keyId}`, so limits are scoped to the right principal.
export async function consumeRateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_consume", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail open
    return data !== false;
  } catch {
    return true; // fail open
  }
}

// Sensible defaults, tuned to be invisible to real usage but to stop scripted
// abuse (e.g. draining the Anthropic budget, or scraping the API to reverse-
// engineer prompt behavior through outputs).
// Login brute-force protection. Per-email catches password-guessing on one
// account; per-IP catches a bot spraying many emails from one source. Tuned so
// a real person mistyping a few times never notices, but a script gets stopped.
export const LOGIN_EMAIL_LIMIT = { max: 8, windowSeconds: 300 }; // 8 tries / email / 5 min
export const LOGIN_IP_LIMIT = { max: 30, windowSeconds: 300 }; // 30 tries / IP / 5 min

export const AI_GENERATION_LIMIT = { max: 40, windowSeconds: 3600 }; // 40 generations / org / hour
export const API_V1_LIMIT = { max: 120, windowSeconds: 60 }; // 120 requests / key / minute
export const ASSISTANT_LIMIT = { max: 60, windowSeconds: 3600 }; // 60 assistant messages / org / hour

// Global ceiling on AI spend across ALL public demo sandboxes combined. Each
// sandbox is its own org, so the per-org limits above don't bound a bot that
// mass-creates orgs. This single shared bucket caps total sandbox AI use no
// matter how many exist, protecting the Anthropic budget. It intentionally does
// NOT apply to the shared wingmandemo sales-call org (not a sandbox), so
// sandbox abuse can't rate-limit a live sales demo.
export const DEMO_AI_GLOBAL_LIMIT = { max: 120, windowSeconds: 3600 }; // 120 AI calls / hour across all sandboxes

/**
 * Consume an AI-generation token for an org. Enforces the per-org limit and, for
 * public demo SANDBOXES, ALSO a global demo-wide ceiling. Returns false if
 * either is exhausted. `bucketPrefix` lets the assistant use its own per-org window.
 */
export async function consumeAiLimit(
  profile: { orgId: string; isDemoSandbox: boolean },
  opts?: { bucketPrefix?: string; max?: number; windowSeconds?: number }
): Promise<boolean> {
  const prefix = opts?.bucketPrefix ?? "ai";
  const max = opts?.max ?? AI_GENERATION_LIMIT.max;
  const windowSeconds = opts?.windowSeconds ?? AI_GENERATION_LIMIT.windowSeconds;

  const perOrg = await consumeRateLimit(`${prefix}:${profile.orgId}`, max, windowSeconds);
  if (!perOrg) return false;
  if (profile.isDemoSandbox) {
    return consumeRateLimit("ai:demo-global", DEMO_AI_GLOBAL_LIMIT.max, DEMO_AI_GLOBAL_LIMIT.windowSeconds);
  }
  return true;
}
