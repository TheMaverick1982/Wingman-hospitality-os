// Fire-and-forget: send a client-side runtime error to the monitor endpoint.
// Safe to call from an error boundary's effect — it never throws and ignores
// failures (the point is capturing bugs, not creating new ones).
export function reportClientError(error: Error & { digest?: string }): void {
  try {
    const payload = JSON.stringify({
      message: error?.message || String(error),
      stack: error?.stack,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    // keepalive lets the POST survive a navigation/unmount.
    void fetch("/api/monitor/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
