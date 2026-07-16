import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Data access for Learning Paths. All reads/writes go through the service-role
// client; the server actions that call these enforce permissions (managers+ to
// manage; staff to read/complete their own assignments).

export type StepKind = "test" | "training" | "task";
export type PathStep = { id: string; sortOrder: number; kind: StepKind; testId: string | null; department: string | null; title: string; detail: string };
export type PathSummary = { id: string; title: string; description: string; archived: boolean; stepCount: number; assignedCount: number };
export type PathDetail = { id: string; title: string; description: string; archived: boolean; steps: PathStep[] };

function mapStep(r: Record<string, unknown>): PathStep {
  return {
    id: String(r.id),
    sortOrder: Number(r.sort_order ?? 0),
    kind: (r.kind as StepKind) ?? "task",
    testId: (r.test_id as string) ?? null,
    department: (r.department as string) ?? null,
    title: String(r.title ?? ""),
    detail: String(r.detail ?? ""),
  };
}

export async function getPathsForOrg(orgId: string): Promise<PathSummary[]> {
  const admin = createAdminClient();
  const { data: paths } = await admin.from("learning_paths").select("id, title, description, archived").eq("org_id", orgId).order("created_at", { ascending: false });
  const rows = (paths ?? []) as { id: string; title: string; description: string; archived: boolean }[];
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);
  const [{ data: steps }, { data: assigns }] = await Promise.all([
    admin.from("learning_path_steps").select("path_id").in("path_id", ids),
    admin.from("learning_path_assignments").select("path_id").in("path_id", ids),
  ]);
  const stepCount = new Map<string, number>();
  for (const s of (steps ?? []) as { path_id: string }[]) stepCount.set(s.path_id, (stepCount.get(s.path_id) ?? 0) + 1);
  const assignCount = new Map<string, number>();
  for (const a of (assigns ?? []) as { path_id: string }[]) assignCount.set(a.path_id, (assignCount.get(a.path_id) ?? 0) + 1);
  return rows.map((p) => ({ id: p.id, title: p.title, description: p.description, archived: p.archived, stepCount: stepCount.get(p.id) ?? 0, assignedCount: assignCount.get(p.id) ?? 0 }));
}

export async function getPath(orgId: string, pathId: string): Promise<PathDetail | null> {
  const admin = createAdminClient();
  const { data: p } = await admin.from("learning_paths").select("id, title, description, archived, org_id").eq("id", pathId).maybeSingle();
  const path = p as { id: string; title: string; description: string; archived: boolean; org_id: string } | null;
  if (!path || path.org_id !== orgId) return null;
  const { data: steps } = await admin.from("learning_path_steps").select("*").eq("path_id", pathId).order("sort_order");
  return { id: path.id, title: path.title, description: path.description, archived: path.archived, steps: ((steps ?? []) as Record<string, unknown>[]).map(mapStep) };
}

export async function createPath(orgId: string, userId: string, title: string, description: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("learning_paths").insert({ org_id: orgId, created_by: userId, title, description }).select("id").single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function addStep(orgId: string, pathId: string, step: { kind: StepKind; testId?: string | null; department?: string | null; title: string; detail?: string }): Promise<void> {
  const admin = createAdminClient();
  const { data: last } = await admin.from("learning_path_steps").select("sort_order").eq("path_id", pathId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const next = ((last as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
  await admin.from("learning_path_steps").insert({
    org_id: orgId, path_id: pathId, sort_order: next, kind: step.kind,
    test_id: step.kind === "test" ? step.testId ?? null : null,
    department: step.kind === "training" ? step.department ?? null : null,
    title: step.title, detail: step.detail ?? "",
  });
}

export async function deleteStep(pathId: string, stepId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("learning_path_steps").delete().eq("id", stepId).eq("path_id", pathId);
}

export async function setPathArchived(orgId: string, pathId: string, archived: boolean): Promise<void> {
  const admin = createAdminClient();
  await admin.from("learning_paths").update({ archived }).eq("id", pathId).eq("org_id", orgId);
}

export async function deletePath(orgId: string, pathId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("learning_paths").delete().eq("id", pathId).eq("org_id", orgId);
}

export async function assignPath(orgId: string, pathId: string, assignedBy: string, staffProfileIds: string[]): Promise<void> {
  const admin = createAdminClient();
  const rows = staffProfileIds.map((id) => ({ org_id: orgId, path_id: pathId, staff_profile_id: id, assigned_by: assignedBy }));
  if (rows.length) await admin.from("learning_path_assignments").upsert(rows, { onConflict: "path_id,staff_profile_id" });
}

export async function unassignPath(pathId: string, staffProfileId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("learning_path_assignments").delete().eq("path_id", pathId).eq("staff_profile_id", staffProfileId);
}

export type AssigneeProgress = { profileId: string; name: string; done: number; total: number };

// Per-assignee completion for a path (for the manager overview).
export async function getPathOverview(pathId: string, nameById: Map<string, string>): Promise<AssigneeProgress[]> {
  const admin = createAdminClient();
  const [{ data: assigns }, { count: total }] = await Promise.all([
    admin.from("learning_path_assignments").select("id, staff_profile_id").eq("path_id", pathId),
    admin.from("learning_path_steps").select("id", { count: "exact", head: true }).eq("path_id", pathId),
  ]);
  const rows = (assigns ?? []) as { id: string; staff_profile_id: string }[];
  const out: AssigneeProgress[] = [];
  for (const a of rows) {
    const { count: done } = await admin.from("learning_path_progress").select("id", { count: "exact", head: true }).eq("assignment_id", a.id);
    out.push({ profileId: a.staff_profile_id, name: nameById.get(a.staff_profile_id) ?? "Someone", done: done ?? 0, total: total ?? 0 });
  }
  return out.sort((x, y) => x.done / Math.max(1, x.total) - y.done / Math.max(1, y.total));
}

export type StaffPath = { assignmentId: string; pathId: string; title: string; description: string; steps: PathStep[]; completedStepIds: Set<string> };

// A staff member's assigned paths, with their completed steps.
export async function getStaffPaths(profileId: string): Promise<StaffPath[]> {
  const admin = createAdminClient();
  const { data: assigns } = await admin
    .from("learning_path_assignments")
    .select("id, path_id, learning_paths(title, description, archived)")
    .eq("staff_profile_id", profileId);
  const rows = (assigns ?? []) as unknown as { id: string; path_id: string; learning_paths: { title: string; description: string; archived: boolean } | null }[];
  const out: StaffPath[] = [];
  for (const a of rows) {
    if (!a.learning_paths || a.learning_paths.archived) continue;
    const [{ data: steps }, { data: prog }] = await Promise.all([
      admin.from("learning_path_steps").select("*").eq("path_id", a.path_id).order("sort_order"),
      admin.from("learning_path_progress").select("step_id").eq("assignment_id", a.id),
    ]);
    out.push({
      assignmentId: a.id,
      pathId: a.path_id,
      title: a.learning_paths.title,
      description: a.learning_paths.description,
      steps: ((steps ?? []) as Record<string, unknown>[]).map(mapStep),
      completedStepIds: new Set(((prog ?? []) as { step_id: string }[]).map((p) => p.step_id)),
    });
  }
  return out;
}

// Mark/unmark a step done for a staff member's own assignment (verifies ownership).
export async function setStepDone(profileId: string, assignmentId: string, stepId: string, done: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { data: a } = await admin.from("learning_path_assignments").select("staff_profile_id").eq("id", assignmentId).maybeSingle();
  if ((a as { staff_profile_id?: string } | null)?.staff_profile_id !== profileId) return false;
  if (done) await admin.from("learning_path_progress").upsert({ assignment_id: assignmentId, step_id: stepId }, { onConflict: "assignment_id,step_id" });
  else await admin.from("learning_path_progress").delete().eq("assignment_id", assignmentId).eq("step_id", stepId);
  return true;
}
