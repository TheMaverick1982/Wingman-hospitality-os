import "server-only";

// fetch() that retries transient failures — HTTP 429 (rate limited) and 5xx —
// with exponential backoff + jitter, honoring a Retry-After header when the
// provider sends one. Used for the Resend + Twilio calls so a brief rate-limit
// spike during a burst doesn't silently drop a recipient. Non-transient responses
// (4xx other than 429) return immediately; the caller inspects res.ok.
export async function fetchWithRetry(url: string, init: RequestInit, opts?: { attempts?: number }): Promise<Response> {
  const attempts = Math.max(1, opts?.attempts ?? 3);
  let res: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    res = await fetch(url, init);
    if (res.ok) return res;
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || i === attempts - 1) return res;
    // Free the unread body before retrying.
    await res.arrayBuffer().catch(() => {});
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : 2 ** i * 500 + Math.random() * 250;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return res as Response;
}
