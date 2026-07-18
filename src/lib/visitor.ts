import "server-only";
import { cookies } from "next/headers";

// First-party visitor cookie for anonymous page-view analytics. Set by /api/track
// on the first request; read at conversion to link the visitor to a CRM contact.
export const VISITOR_COOKIE = "wm_vid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Read the current visitor id from the cookie, or null. Safe to call outside a
// request context (returns null instead of throwing) so best-effort callers in
// shared libs don't have to care.
export async function getVisitorId(): Promise<string | null> {
  try {
    const v = (await cookies()).get(VISITOR_COOKIE)?.value ?? "";
    return UUID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}
