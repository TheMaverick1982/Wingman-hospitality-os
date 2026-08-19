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

// One activity row, with the actor name resolved (current profile name first,
// falling back to the name stored on the event).
export type ActivityListRow = {
  id: string;
  actorId: string | null;
  actorName: string;
  area: string;
  action: string;
  label: string;
  createdAt: string;
  // The IANA time zone to show this event's time in — the acting user's home
  // location's zone, so a multi-location owner reads each entry in the store's
  // local time. Falls back to the viewer's zone when the actor has no single
  // location (system rows, all-locations owners).
  timezone: string | null;
};

// The activity trail grows without bound per org, so it's read a page at a time
// (offset/limit) rather than capped at a fixed slab. Returns the page plus a
// `hasMore` flag (true when a full page came back, so a "Load more" is worth
// showing). Names are resolved against the current team roster in one lookup.
export const ACTIVITY_PAGE_SIZE = 100;

export async function listActivity(
  orgId: string,
  offset = 0,
  limit = ACTIVITY_PAGE_SIZE,
  fallbackTz: string | null = null
): Promise<{ rows: ActivityListRow[]; hasMore: boolean }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("activity_events")
    .select("id, actor_id, actor_name, area, action, label, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const raw = (data ?? []) as { id: string; actor_id: string | null; actor_name: string; area: string; action: string; label: string; created_at: string }[];

  // Resolve current names for the actors on this page (falls back to stored
  // name), and each actor's home-location time zone in the same pass, so every
  // entry shows in the store's local time rather than the viewer's browser.
  const ids = [...new Set(raw.map((r) => r.actor_id).filter((v): v is string => Boolean(v)))];
  const nameById = new Map<string, string>();
  const locByActor = new Map<string, string | null>();
  if (ids.length) {
    const { data: people } = await admin.from("profiles").select("id, full_name, location_id").in("id", ids);
    const locIds = new Set<string>();
    for (const p of (people ?? []) as { id: string; full_name: string; location_id: string | null }[]) {
      nameById.set(p.id, p.full_name);
      locByActor.set(p.id, p.location_id);
      if (p.location_id) locIds.add(p.location_id);
    }
    const tzByLoc = new Map<string, string | null>();
    if (locIds.size) {
      const { data: locs } = await admin.from("locations").select("id, timezone").in("id", [...locIds]);
      for (const l of (locs ?? []) as { id: string; timezone: string | null }[]) tzByLoc.set(l.id, l.timezone);
    }
    // Re-key the actor→location map to actor→timezone for the row builder.
    for (const [actorId, locId] of locByActor) {
      locByActor.set(actorId, locId ? tzByLoc.get(locId) ?? null : null);
    }
  }

  const rows: ActivityListRow[] = raw.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: (r.actor_id ? nameById.get(r.actor_id) : "") || r.actor_name || "Someone",
    area: r.area,
    action: r.action,
    label: r.label,
    createdAt: r.created_at,
    timezone: (r.actor_id ? locByActor.get(r.actor_id) : null) || fallbackTz,
  }));
  return { rows, hasMore: raw.length === limit };
}
