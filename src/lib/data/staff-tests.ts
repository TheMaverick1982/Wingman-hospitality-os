import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// A staffer's own test assignments (past + current). test_assignments is
// manager-only under RLS, so this reads with the admin client scoped to one
// staff_members id — always resolve that from the current user first.
export type StaffTest = {
  testId: string;
  status: string; // assigned | in_progress | passed | locked
  bestScore: number | null;
  lastScore: number | null;
  passPct: number | null;
  title: string | null;
  dueAt: string | null;
};

type Row = {
  test_id: string;
  status: string;
  best_score: number | null;
  last_score: number | null;
  due_at: string | null;
  // Supabase types the embed as an array; at runtime it's the single joined row.
  tests: { title: string | null; pass_pct: number | null } | { title: string | null; pass_pct: number | null }[] | null;
};

export async function getStaffTests(staffId: string): Promise<StaffTest[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("test_assignments")
    .select("test_id, status, best_score, last_score, due_at, tests(title, pass_pct)")
    .eq("staff_id", staffId)
    .order("assigned_at", { ascending: false });
  return ((data ?? []) as unknown as Row[]).map((a) => {
    const t = Array.isArray(a.tests) ? a.tests[0] : a.tests;
    return {
      testId: a.test_id,
      status: a.status,
      bestScore: a.best_score,
      lastScore: a.last_score,
      passPct: t?.pass_pct ?? null,
      title: t?.title ?? null,
      dueAt: a.due_at,
    };
  });
}

// Convenience: resolve the current user's staff_members row and fetch their
// tests. Returns [] if the user isn't linked to a staff record (e.g. an owner
// who was never added to the roster) — anyone with a link (staff OR manager)
// gets their assigned tests, since managers take tests too.
export async function getMyTests(userId: string, orgId: string): Promise<StaffTest[]> {
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff_members")
    .select("id")
    .eq("profile_id", userId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const staffId = (staff as { id: string } | null)?.id;
  if (!staffId) return [];
  return getStaffTests(staffId);
}

// A test still to be taken (vs. passed/locked).
export const isTestToDo = (t: StaffTest) => t.status === "assigned" || t.status === "in_progress";
