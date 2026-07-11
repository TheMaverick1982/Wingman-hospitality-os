"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isCrmStage, stageLabel } from "@/lib/crm";
import { stopEnrollments, suppressEmail } from "@/lib/crm-sequences";
import { personalize } from "@/lib/name-safety";

export type CrmActionState = { error: string | null; ok: boolean };

async function touch(admin: ReturnType<typeof createAdminClient>, contactId: string) {
  await admin.from("crm_contacts").update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contactId);
}

// Move a contact to a new pipeline stage (called imperatively from the board /
// the detail-page stage selector).
export async function moveContactStage(contactId: string, stage: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  if (!isCrmStage(stage)) return { error: "Unknown stage.", ok: false };

  const admin = createAdminClient();
  const { data: current } = await admin.from("crm_contacts").select("stage").eq("id", contactId).maybeSingle();
  const from = (current as { stage: string } | null)?.stage;
  if (!from) return { error: "Contact not found.", ok: false };
  if (from === stage) return { error: null, ok: true };

  const { error } = await admin.from("crm_contacts").update({ stage, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { error: error.message, ok: false };

  await admin.from("crm_activities").insert({
    contact_id: contactId,
    kind: "stage_change",
    body: `Moved ${stageLabel(from)} → ${stageLabel(stage)}`,
    meta: { from, to: stage },
    created_by: me.userId,
  });

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Edit a contact's details (name, phone, freeform notes).
export async function updateContactDetails(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return { error: "Missing contact.", ok: false };
  const name = String(formData.get("name") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim();

  const admin = createAdminClient();
  const { error } = await admin.from("crm_contacts").update({ name, phone, notes, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { error: error.message, ok: false };
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Mark this contact as having booked a call — stops all their sequences.
export async function markContactBooked(contactId: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: c } = await admin.from("crm_contacts").select("stage").eq("id", contactId).maybeSingle();
  const cur = (c as { stage: string } | null)?.stage;
  const keepStage = cur === "signed_up" || cur === "lost";
  const stage = keepStage ? cur : "demoed";
  await admin.from("crm_contacts").update({ booked_at: now, stage, last_activity_at: now, updated_at: now }).eq("id", contactId);
  await stopEnrollments(contactId, "booked", admin);
  await admin.from("crm_activities").insert({
    contact_id: contactId,
    kind: "system",
    body: keepStage ? "Booked a call — sequences stopped" : "Booked a call — moved to Demo, sequences stopped",
    created_by: me.userId,
  });
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Unsubscribe / suppress this contact — no more automated emails.
export async function unsubscribeContact(contactId: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("email").eq("id", contactId).maybeSingle();
  const email = (c as { email: string } | null)?.email;
  if (!email) return { error: "Contact not found.", ok: false };
  await suppressEmail(email, "manual", admin);
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Permanently delete a contact and everything attached (activities +
// enrollments cascade via FK). Redirects back to the pipeline.
export async function deleteContact(contactId: string): Promise<void> {
  const me = await platformSectionActor("crm");
  if (!me) return;
  const admin = createAdminClient();
  await admin.from("crm_contacts").delete().eq("id", contactId);
  revalidatePath("/admin/crm");
  redirect("/admin/crm");
}

// Add an internal note to a contact's timeline.
export async function addNote(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const contactId = String(formData.get("contactId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!contactId || !body) return { error: "Write a note first.", ok: false };

  const admin = createAdminClient();
  const { error } = await admin.from("crm_activities").insert({ contact_id: contactId, kind: "note", body, created_by: me.userId });
  if (error) return { error: error.message, ok: false };
  await touch(admin, contactId);
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Send a one-off email to the contact and log it to the timeline.
export async function sendContactEmail(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const contactId = String(formData.get("contactId") || "");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!contactId || !subject || !body) return { error: "Subject and message are required.", ok: false };

  const admin = createAdminClient();
  const { data: contact } = await admin.from("crm_contacts").select("email, name, unsubscribed").eq("id", contactId).maybeSingle();
  const c = contact as { email: string; name: string | null; unsubscribed: boolean } | null;
  if (!c) return { error: "Contact not found.", ok: false };
  if (c.unsubscribed) return { error: "This contact has unsubscribed — can't email them.", ok: false };

  // Support {{first_name}} merge fields with the safe-name fallback.
  const finalSubject = personalize(subject, c.name);
  const finalBody = personalize(body, c.name);

  // Minimal branded HTML wrapper around the typed message (newlines → <br>).
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:560px;">${finalBody
    .replace(/[<>&]/g, (ch) => (ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;"))
    .replace(/\n/g, "<br>")}</div>`;

  try {
    await sendEmail({ to: [c.email], subject: finalSubject, html, replyTo: me.email });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send the email.", ok: false };
  }

  await admin.from("crm_activities").insert({
    contact_id: contactId,
    kind: "email_out",
    subject: finalSubject,
    body: finalBody,
    meta: { to: c.email },
    created_by: me.userId,
  });
  await touch(admin, contactId);
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}
