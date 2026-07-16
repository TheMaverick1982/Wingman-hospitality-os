import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Staff activity trail (owner-only surface). Never throws — a logging failure
// must not break the underlying action.

export type ActivityArea =
  | "auth"
  | "guests"
  | "partners"
  | "training"
  | "staff"
  | "checklists"
  | "settings";

export async function logActivity(opts: {
  orgId: string;
  actorId?: string | null;
  actorName?: string;
  area: ActivityArea;
  action: string;
  label?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("activity_events").insert({
      org_id: opts.orgId,
      actor_id: opts.actorId ?? null,
      actor_name: opts.actorName ?? "",
      area: opts.area,
      action: opts.action,
      label: (opts.label ?? "").slice(0, 200),
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

// Record a login at most once per window (default 8h) per user, so each new
// session/day shows up once instead of on every page load. Called from the app
// layout. Best-effort and cheap (one indexed lookup).
export async function logLoginOncePerWindow(orgId: string, actorId: string, actorName: string, windowHours = 8): Promise<void> {
  try {
    const admin = createAdminClient();
    const sinceIso = new Date(Date.now() - windowHours * 3600_000).toISOString();
    const { data: recent } = await admin
      .from("activity_events")
      .select("id")
      .eq("org_id", orgId)
      .eq("actor_id", actorId)
      .eq("action", "login")
      .gte("created_at", sinceIso)
      .limit(1)
      .maybeSingle();
    if (recent) return;
    await admin.from("activity_events").insert({ org_id: orgId, actor_id: actorId, actor_name: actorName, area: "auth", action: "login", label: "Signed in" });
  } catch {
    /* best-effort */
  }
}
