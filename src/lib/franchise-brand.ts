import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Franchise Phase 2 — brand training push-down. The franchisor authors a test in
// their own org, then pushes locked copies to every franchisee. Re-pushing a
// locked test re-syncs the copies. Service-role only (the lock triggers let the
// service role through; authenticated franchisee edits are blocked).

type TestRow = {
  title: string;
  description: string;
  mode: string;
  target_departments: string[];
  day_count: number;
  pass_pct: number;
  max_retakes: number;
  complete_within_amount: number | null;
  complete_within_unit: string;
  rotates_monthly: boolean;
};

export type BrandLibraryTest = {
  id: string;
  title: string;
  departments: string[];
  pushedCount: number; // franchisees it's live at
  locked: boolean; // whether the last push locked it
};

// Tests in the franchisor's own org, with how many franchisees each is pushed to.
export async function getBrandLibrary(sourceOrgId: string, groupId: string): Promise<BrandLibraryTest[]> {
  const admin = createAdminClient();
  const [{ data: tests }, { data: links }] = await Promise.all([
    admin.from("tests").select("id, title, target_departments").eq("org_id", sourceOrgId).eq("active", true).order("created_at", { ascending: false }),
    admin.from("brand_content_links").select("source_id, locked").eq("group_id", groupId).eq("content_type", "test"),
  ]);
  const bySource = new Map<string, { count: number; locked: boolean }>();
  for (const l of (links ?? []) as { source_id: string; locked: boolean }[]) {
    const cur = bySource.get(l.source_id) ?? { count: 0, locked: false };
    cur.count += 1;
    cur.locked = cur.locked || l.locked;
    bySource.set(l.source_id, cur);
  }
  return ((tests ?? []) as { id: string; title: string; target_departments: string[] | null }[]).map((t) => ({
    id: t.id,
    title: t.title,
    departments: (t.target_departments ?? []).filter(Boolean),
    pushedCount: bySource.get(t.id)?.count ?? 0,
    locked: bySource.get(t.id)?.locked ?? false,
  }));
}

// Push (or re-sync) a source test to every active franchisee in the group.
export async function pushBrandTest(groupId: string, sourceOrgId: string, sourceTestId: string, locked: boolean): Promise<{ error: string | null; pushed: number }> {
  const admin = createAdminClient();

  // Load the source test + its days + questions.
  const [{ data: srcTest }, { data: srcDays }, { data: srcQs }] = await Promise.all([
    admin.from("tests").select("title, description, mode, target_departments, day_count, pass_pct, max_retakes, complete_within_amount, complete_within_unit, rotates_monthly").eq("id", sourceTestId).eq("org_id", sourceOrgId).maybeSingle(),
    admin.from("test_days").select("day_number, title, content").eq("test_id", sourceTestId).order("day_number"),
    admin.from("test_questions").select("day_number, sort_order, kind, prompt, options, correct_index, explanation").eq("test_id", sourceTestId).order("day_number").order("sort_order"),
  ]);
  const test = srcTest as TestRow | null;
  if (!test) return { error: "Source test not found.", pushed: 0 };
  const days = (srcDays ?? []) as { day_number: number; title: string; content: string }[];
  const questions = (srcQs ?? []) as { day_number: number; sort_order: number; kind: string; prompt: string; options: string[]; correct_index: number; explanation: string }[];

  // Active franchisees (exclude the source org itself).
  const { data: members } = await admin.from("franchise_memberships").select("org_id").eq("group_id", groupId).eq("status", "active");
  const orgIds = ((members ?? []) as { org_id: string }[]).map((m) => m.org_id).filter((id) => id !== sourceOrgId);

  const { data: existing } = await admin.from("brand_content_links").select("org_id, local_id").eq("group_id", groupId).eq("source_id", sourceTestId);
  const localByOrg = new Map(((existing ?? []) as { org_id: string; local_id: string }[]).map((l) => [l.org_id, l.local_id]));

  let pushed = 0;
  for (const orgId of orgIds) {
    try {
      let localId = localByOrg.get(orgId);
      if (localId) {
        // Re-sync: clear child rows and update the test. The lock trigger lets
        // the service role through; we drop the lock during the rewrite then
        // re-apply it so triggers never see a locked parent mid-edit.
        await admin.from("tests").update({ brand_locked: false }).eq("id", localId);
        await admin.from("test_questions").delete().eq("test_id", localId);
        await admin.from("test_days").delete().eq("test_id", localId);
      } else {
        const { data: created, error } = await admin
          .from("tests")
          .insert({ ...testInsert(test, orgId), brand_locked: false, brand_group_id: groupId, source: "training" })
          .select("id")
          .single();
        if (error || !created) continue;
        localId = created.id as string;
        await admin.from("brand_content_links").insert({ group_id: groupId, content_type: "test", source_id: sourceTestId, org_id: orgId, local_id: localId, locked });
      }

      if (days.length) await admin.from("test_days").insert(days.map((d) => ({ test_id: localId, org_id: orgId, day_number: d.day_number, title: d.title, content: d.content })));
      if (questions.length)
        await admin.from("test_questions").insert(
          questions.map((q) => ({ test_id: localId, org_id: orgId, day_number: q.day_number, sort_order: q.sort_order, kind: q.kind, prompt: q.prompt, options: q.options, correct_index: q.correct_index, explanation: q.explanation })),
        );

      // Apply final lock state + refresh the test fields + link timestamp.
      await admin.from("tests").update({ ...testInsert(test, orgId), brand_locked: locked, brand_group_id: groupId }).eq("id", localId);
      await admin.from("brand_content_links").update({ locked, last_pushed_at: new Date().toISOString() }).eq("group_id", groupId).eq("source_id", sourceTestId).eq("org_id", orgId);
      pushed += 1;
    } catch {
      /* skip a franchisee that fails; the rest still get it */
    }
  }
  return { error: null, pushed };
}

function testInsert(t: TestRow, orgId: string) {
  return {
    org_id: orgId,
    title: t.title,
    description: t.description,
    mode: t.mode,
    target_departments: t.target_departments,
    day_count: t.day_count,
    pass_pct: t.pass_pct,
    max_retakes: t.max_retakes,
    complete_within_amount: t.complete_within_amount,
    complete_within_unit: t.complete_within_unit,
    rotates_monthly: t.rotates_monthly,
    active: true,
  };
}
