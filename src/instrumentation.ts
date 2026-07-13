// Next.js server-error hook — fires for uncaught errors in Server Components,
// route handlers, and server actions, so the monitor sees server-side bugs
// without wrapping every call site. Best-effort; only runs in the Node runtime.
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string }
): Promise<void> {
  try {
    // The error monitor pulls in server-only + node crypto, so keep it off the
    // edge runtime.
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const { reportError } = await import("@/lib/error-monitor");
    await reportError({ error, source: "server", route: request?.path ?? context?.routePath ?? null });
  } catch {
    // never let instrumentation throw
  }
}
