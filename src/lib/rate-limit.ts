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
export const AI_GENERATION_LIMIT = { max: 40, windowSeconds: 3600 }; // 40 generations / org / hour
export const API_V1_LIMIT = { max: 120, windowSeconds: 60 }; // 120 requests / key / minute
export const ASSISTANT_LIMIT = { max: 60, windowSeconds: 3600 }; // 60 assistant messages / org / hour
