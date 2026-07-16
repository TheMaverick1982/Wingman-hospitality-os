"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity-log";
import {
  createPath, addStep, deleteStep, setPathArchived, deletePath, assignPath, unassignPath, setStepDone,
  type StepKind,
} from "@/lib/learning-paths";

type State = { error: string | null; ok?: boolean; id?: string };

async function manager() {
  const p = await getCurrentProfile();
  return p && isManagerOrAbove(p.accessRole) ? p : null;
}

export async function createPathAction(_prev: State, formData: FormData): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Only managers and owners can build paths." };
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the path a name." };
  const id = await createPath(p.orgId, p.userId, title, String(formData.get("description") ?? "").trim());
  if (!id) return { error: "Couldn't create the path." };
  await logActivity({ orgId: p.orgId, actorId: p.userId, actorName: p.fullName, area: "training", action: "created", label: `path: ${title}` });
  revalidatePath("/training/paths");
  return { error: null, ok: true, id };
}

export async function addStepAction(pathId: string, step: { kind: StepKind; testId?: string | null; department?: string | null; title: string; detail?: string }): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Not authorized." };
  if (!step.title.trim() && step.kind === "task") return { error: "Give the step a title." };
  await addStep(p.orgId, pathId, step);
  revalidatePath(`/training/paths/${pathId}`);
  return { error: null, ok: true };
}

export async function deleteStepAction(pathId: string, stepId: string): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Not authorized." };
  await deleteStep(pathId, stepId);
  revalidatePath(`/training/paths/${pathId}`);
  return { error: null, ok: true };
}

export async function archivePathAction(pathId: string, archived: boolean): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Not authorized." };
  await setPathArchived(p.orgId, pathId, archived);
  revalidatePath("/training/paths");
  revalidatePath(`/training/paths/${pathId}`);
  return { error: null, ok: true };
}

export async function deletePathAction(pathId: string): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Not authorized." };
  await deletePath(p.orgId, pathId);
  revalidatePath("/training/paths");
  return { error: null, ok: true };
}

export async function assignPathAction(pathId: string, staffProfileIds: string[]): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Not authorized." };
  if (!staffProfileIds.length) return { error: "Pick at least one person." };
  await assignPath(p.orgId, pathId, p.userId, staffProfileIds);
  revalidatePath(`/training/paths/${pathId}`);
  return { error: null, ok: true };
}

export async function unassignPathAction(pathId: string, staffProfileId: string): Promise<State> {
  const p = await manager();
  if (!p) return { error: "Not authorized." };
  await unassignPath(pathId, staffProfileId);
  revalidatePath(`/training/paths/${pathId}`);
  return { error: null, ok: true };
}

// Staff mark their own step done (or undo).
export async function toggleStepDoneAction(assignmentId: string, stepId: string, done: boolean): Promise<State> {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  const ok = await setStepDone(p.userId, assignmentId, stepId, done);
  if (!ok) return { error: "That isn't your assignment." };
  revalidatePath("/training/paths");
  return { error: null, ok: true };
}
