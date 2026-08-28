import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Staff training leaderboard — derived from existing data (test results +
// training sign-offs). Points are simple and explainable:
//   passed test  = 10 pts each
//   score bonus  = round(avg best score / 10)
//   sign-off     = 3 pts each (matched by name within the org)
// Ranked per location. Badges are milestones, not points.

export type Badge = "certified" | "perfect" | "streak";
export type LeaderRow = {
  staffId: string;
  name: string;
  department: string;
  points: number;
  testsPassed: number;
  avgScore: number | null;
  badges: Badge[];
};

const DAY = 86400000;

// `location` scopes the ranked staff: a single id, a set of ids (a
// specific-locations manager's reachable stores), or null for the whole org.
// An empty array is treated as "no accessible location" → no one, never the
// whole org, so a mis-scoped caller can't accidentally leak every store.
export async function computeLeaderboard(orgId: string, location: string | string[] | null): Promise<LeaderRow[]> {
  const admin = createAdminClient();

  let staffQ = admin.from("staff_members").select("id, full_name, department, location_id, status").eq("org_id", orgId).eq("status", "active");
  if (Array.isArray(location)) staffQ = staffQ.in("location_id", location.length ? location : ["00000000-0000-0000-0000-000000000000"]);
  else if (location) staffQ = staffQ.eq("location_id", location);
  const [{ data: staff }, { data: attempts }, { data: signoffs }] = await Promise.all([
    staffQ,
    admin.from("test_assignments").select("staff_id, best_score, passed_at, status").eq("org_id", orgId),
    admin.from("training_signoffs").select("staff_name, completion_pct, occurred_on").eq("org_id", orgId),
  ]);

  const staffRows = (staff ?? []) as { id: string; full_name: string; department: string; location_id: string }[];
  const nowMs = Date.now();

  // Aggregate test results per staff_id.
  const passedByStaff = new Map<string, { count: number; scoreSum: number; recent: number; perfect: boolean }>();
  for (const a of (attempts ?? []) as { staff_id: string; best_score: number | null; passed_at: string | null; status: string }[]) {
    const isPassed = Boolean(a.passed_at) || a.status === "passed";
    if (!isPassed) continue;
    const cur = passedByStaff.get(a.staff_id) ?? { count: 0, scoreSum: 0, recent: 0, perfect: false };
    cur.count += 1;
    cur.scoreSum += a.best_score ?? 0;
    if ((a.best_score ?? 0) >= 100) cur.perfect = true;
    if (a.passed_at && nowMs - new Date(a.passed_at).getTime() <= 30 * DAY) cur.recent += 1;
    passedByStaff.set(a.staff_id, cur);
  }

  // Sign-offs matched by name (best-effort — sign-offs store a name, not an id).
  const signoffByName = new Map<string, number>();
  for (const s of (signoffs ?? []) as { staff_name: string; completion_pct: number }[]) {
    const key = (s.staff_name || "").trim().toLowerCase();
    if (!key) continue;
    signoffByName.set(key, (signoffByName.get(key) ?? 0) + 1);
  }

  const rows: LeaderRow[] = staffRows.map((sm) => {
    const t = passedByStaff.get(sm.id) ?? { count: 0, scoreSum: 0, recent: 0, perfect: false };
    const avg = t.count > 0 ? Math.round(t.scoreSum / t.count) : null;
    const signoffs = signoffByName.get(sm.full_name.trim().toLowerCase()) ?? 0;
    const points = t.count * 10 + (avg != null ? Math.round(avg / 10) : 0) + signoffs * 3;
    const badges: Badge[] = [];
    if (t.count >= 1) badges.push("certified");
    if (t.perfect) badges.push("perfect");
    if (t.recent >= 3) badges.push("streak");
    return { staffId: sm.id, name: sm.full_name, department: sm.department, points, testsPassed: t.count, avgScore: avg, badges };
  });

  return rows.sort((a, b) => b.points - a.points || b.testsPassed - a.testsPassed || a.name.localeCompare(b.name));
}

export const BADGE_META: Record<Badge, { label: string; title: string }> = {
  certified: { label: "Certified", title: "Passed at least one test" },
  perfect: { label: "Perfect score", title: "Aced a test at 100%" },
  streak: { label: "On a roll", title: "Passed 3+ tests in the last 30 days" },
};
