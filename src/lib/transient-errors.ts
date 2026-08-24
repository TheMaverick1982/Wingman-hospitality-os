// Transient client-side network / navigation failures — a dropped connection, a
// failed RSC navigation or route prefetch, an aborted request, or a JS chunk that
// 404s briefly during a deploy. These are NOT code bugs (there's nothing to fix in
// our source), so the error monitor treats them as noise instead of raising a bug
// alert, the same way it already ignores Next's redirect/not-found control flow.
//
// Kept dependency-free (no "server-only") so both the client reporter and the
// server-side monitor can share it.
export function isTransientClientError(message: string | undefined | null): boolean {
  const m = (message ?? "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("load failed") || // Safari/WebKit fetch failure
    m.includes("failed to fetch") || // Chromium fetch failure
    m.includes("networkerror") || // Firefox
    m.includes("network request failed") ||
    m.includes("the network connection was lost") ||
    m.includes("the request timed out") ||
    m.includes("err_network") ||
    m.includes("err_internet_disconnected") ||
    m.includes("load cancelled") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("chunkloaderror") ||
    m.includes("loading chunk") // webpack chunk load failure
  );
}
