"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedNurtureSequences } from "@/lib/crm-seed";

async function guard() {
  return platformSectionActor("crm");
}

export type ResyncState = { done: boolean; message: string | null };

// One-click resync of the spec nurture copy (demo / calculator / scorecard) —
// same work as the CRON_SECRET route, behind admin auth. Leaves everything in
// draft; skips any sequence you've already published. Returns a summary so the
// UI can confirm completion.
export async function resyncSpecCopy(_prev: ResyncState, _formData: FormData): Promise<ResyncState> {
  if (!(await guard())) return { done: false, message: "Not authorized." };
  const results = await seedNurtureSequences(false);
  revalidatePath("/admin/crm/automations");

  const seeded = results.filter((r) => r.action === "reseeded" || r.action === "created").length;
  const skipped = results.filter((r) => r.action.startsWith("skipped")).length;
  const retired = results.filter((r) => r.action === "retired").length;
  const parts = [`${seeded} sequence${seeded === 1 ? "" : "s"} synced`];
  if (skipped) parts.push(`${skipped} left alone (already published)`);
  if (retired) parts.push(`${retired} retired`);
  return { done: true, message: parts.join(" · ") };
}

export async function setSequenceActive(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const sequenceId = String(formData.get("sequenceId") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!sequenceId) return;
  const admin = createAdminClient();
  await admin.from("crm_sequences").update({ active, updated_at: new Date().toISOString() }).eq("id", sequenceId);
  revalidatePath("/admin/crm/automations");
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}

// Draft ⇄ Published. Drafts never enroll or send.
export async function setSequencePublished(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const sequenceId = String(formData.get("sequenceId") || "");
  const published = String(formData.get("published") || "") === "true";
  if (!sequenceId) return;
  const admin = createAdminClient();
  await admin.from("crm_sequences").update({ published, updated_at: new Date().toISOString() }).eq("id", sequenceId);
  revalidatePath("/admin/crm/automations");
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}

export async function updateStep(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const stepId = String(formData.get("stepId") || "");
  const sequenceId = String(formData.get("sequenceId") || "");
  const channel = String(formData.get("channel") || "email") === "sms" ? "sms" : "email";
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const delayRaw = Number(formData.get("delay_days"));
  const delay_days = Number.isFinite(delayRaw) && delayRaw >= 0 ? Math.round(delayRaw) : 0;
  const active = String(formData.get("active") || "") === "on";
  // Email needs a subject; SMS has none (the body IS the message). Body always required.
  if (!stepId || !body) return;
  if (channel === "email" && !subject) return;
  const admin = createAdminClient();
  await admin
    .from("crm_sequence_steps")
    .update({ channel, subject: channel === "sms" ? "" : subject, body, delay_days, active, updated_at: new Date().toISOString() })
    .eq("id", stepId);
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}

export async function addStep(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const sequenceId = String(formData.get("sequenceId") || "");
  if (!sequenceId) return;
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("crm_sequence_steps")
    .select("step_order, delay_days")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = last as { step_order: number; delay_days: number } | null;
  const nextOrder = (prev?.step_order ?? 0) + 1;
  const nextDelay = (prev?.delay_days ?? 0) + 7;
  await admin.from("crm_sequence_steps").insert({
    sequence_id: sequenceId,
    step_order: nextOrder,
    delay_days: nextDelay,
    subject: "New email subject",
    body: "Hi {{first_name}},\n\nWrite your message here.\n\nhttps://www.joinwingman.app/demo",
  });
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}

export async function deleteStep(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const stepId = String(formData.get("stepId") || "");
  const sequenceId = String(formData.get("sequenceId") || "");
  if (!stepId) return;
  const admin = createAdminClient();
  await admin.from("crm_sequence_steps").delete().eq("id", stepId);
  // Close the gap left in step_order so the sequence stays 1..n contiguous.
  if (sequenceId) {
    const { data } = await admin.from("crm_sequence_steps").select("id").eq("sequence_id", sequenceId).order("step_order", { ascending: true });
    await renumberSteps(admin, sequenceId, ((data ?? []) as { id: string }[]).map((r) => r.id));
  }
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}

// Rewrite step_order to match the given id order (1..n). Two-phase — park in a
// high range first — so the unique(sequence_id, step_order) constraint can't be
// violated mid-update while rows swap places.
async function renumberSteps(admin: ReturnType<typeof createAdminClient>, sequenceId: string, orderedIds: string[]): Promise<void> {
  const nowIso = new Date().toISOString();
  for (let k = 0; k < orderedIds.length; k++) {
    await admin.from("crm_sequence_steps").update({ step_order: 100000 + k, updated_at: nowIso }).eq("id", orderedIds[k]).eq("sequence_id", sequenceId);
  }
  for (let k = 0; k < orderedIds.length; k++) {
    await admin.from("crm_sequence_steps").update({ step_order: k + 1, updated_at: nowIso }).eq("id", orderedIds[k]).eq("sequence_id", sequenceId);
  }
}

// Move a step one position up or down within its sequence.
export async function moveStep(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const stepId = String(formData.get("stepId") || "");
  const sequenceId = String(formData.get("sequenceId") || "");
  const direction = String(formData.get("direction") || "");
  if (!stepId || !sequenceId || (direction !== "up" && direction !== "down")) return;
  const admin = createAdminClient();
  const { data } = await admin.from("crm_sequence_steps").select("id").eq("sequence_id", sequenceId).order("step_order", { ascending: true });
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const i = ids.indexOf(stepId);
  if (i < 0) return;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await renumberSteps(admin, sequenceId, ids);
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}

// Insert a fresh step directly after the given step (not just at the end).
export async function insertStepAfter(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const afterStepId = String(formData.get("stepId") || "");
  const sequenceId = String(formData.get("sequenceId") || "");
  if (!afterStepId || !sequenceId) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from("crm_sequence_steps")
    .select("id, step_order, delay_days")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });
  const steps = (data ?? []) as { id: string; step_order: number; delay_days: number }[];
  const i = steps.findIndex((s) => s.id === afterStepId);
  if (i < 0) return;
  const prev = steps[i];
  const next = steps[i + 1];
  // Slot the new step's day between its neighbors (or a week after the last one).
  const delay_days = next ? Math.round((prev.delay_days + next.delay_days) / 2) : prev.delay_days + 7;
  const { data: created } = await admin
    .from("crm_sequence_steps")
    .insert({
      sequence_id: sequenceId,
      step_order: 999000, // temporary; renumberSteps assigns the real slot
      delay_days,
      subject: "New email subject",
      body: "Hi {{first_name}},\n\nWrite your message here.\n\nhttps://www.joinwingman.app/demo",
    })
    .select("id")
    .single();
  const newId = (created as { id: string } | null)?.id;
  if (!newId) return;
  const ids = steps.map((s) => s.id);
  ids.splice(i + 1, 0, newId);
  await renumberSteps(admin, sequenceId, ids);
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}
