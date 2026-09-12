// Version-skew detection + recovery for the error boundaries.
//
// When a new version is deployed, a browser tab still showing the OLD page holds
// stale asset URLs and (crucially) stale Server Action IDs. Submitting from it —
// e.g. the login form — POSTs an action ID the new deployment can't find, which
// Next surfaces as "Failed to find Server Action. This request might be from an
// older or newer deployment." React's reset() can't fix it (same stale bundle);
// only a FULL page reload fetches the current deployment. See:
// https://nextjs.org/docs/messages/failed-to-find-server-action

export function isVersionSkewError(error?: { message?: string; digest?: string } | null): boolean {
  const s = `${error?.message ?? ""} ${error?.digest ?? ""}`.toLowerCase();
  return (
    s.includes("failed to find server action") ||
    s.includes("older or newer deployment") ||
    (s.includes("server action") && s.includes("deployment"))
  );
}

// Hard-reload to pull the current deployment, but at most once per short window
// so a genuinely broken deploy can never trap the user in a reload loop. Returns
// true if a reload was triggered. If sessionStorage is unavailable we can't guard
// against a loop, so we decline to auto-reload and leave it to the manual button.
export function reloadOnceForSkew(): boolean {
  const KEY = "wm:skew-reload";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < 20000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
