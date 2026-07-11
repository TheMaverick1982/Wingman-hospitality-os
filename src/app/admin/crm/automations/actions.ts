"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedNurtureSequences } from "@/lib/crm-seed";

async function guard() {
  return platformSectionActor("crm");
}

// One-click resync of the spec nurture copy (demo / calculator / scorecard) —
// same work as the CRON_SECRET route, behind admin auth. Leaves everything in
// draft; skips any sequence you've already published.
export async function resyncSpecCopy(): Promise<void> {
  if (!(await guard())) return;
  await seedNurtureSequences(false);
  revalidatePath("/admin/crm/automations");
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
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const delayRaw = Number(formData.get("delay_days"));
  const delay_days = Number.isFinite(delayRaw) && delayRaw >= 0 ? Math.round(delayRaw) : 0;
  const active = String(formData.get("active") || "") === "on";
  if (!stepId || !subject || !body) return;
  const admin = createAdminClient();
  await admin.from("crm_sequence_steps").update({ subject, body, delay_days, active, updated_at: new Date().toISOString() }).eq("id", stepId);
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
  revalidatePath(`/admin/crm/automations/${sequenceId}`);
}
