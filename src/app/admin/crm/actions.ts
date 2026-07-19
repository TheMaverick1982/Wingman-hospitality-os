"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isCrmStage, stageLabel, isCustomContactField } from "@/lib/crm";
import { stopEnrollments, suppressEmail, buildSequenceEmailHtml } from "@/lib/crm-sequences";
import { sendConversationSms } from "@/lib/conversations";
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

// Assign (or unassign) a contact to a sales rep. Drives the per-rep Sales
// Dashboard metrics. Empty repId clears the assignment.
export async function assignContact(contactId: string, repId: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  if (!contactId) return { error: "Missing contact.", ok: false };
  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_contacts")
    .update({ assigned_rep_id: repId || null, updated_at: new Date().toISOString() })
    .eq("id", contactId);
  if (error) return { error: error.message, ok: false };
  await admin.from("crm_activities").insert({
    contact_id: contactId,
    kind: "system",
    body: repId ? "Assigned to a sales rep" : "Unassigned from sales rep",
    created_by: me.userId,
  });
  revalidatePath(`/admin/crm/${contactId}`);
  revalidatePath("/admin/sales-dashboard");
  return { error: null, ok: true };
}

// Edit a contact's details (name, email, phone, freeform notes).
export async function updateContactDetails(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return { error: "Missing contact.", ok: false };
  const name = String(formData.get("name") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address.", ok: false };

  const admin = createAdminClient();
  const { error } = await admin.from("crm_contacts").update({ name, email, phone, notes, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) {
    if (error.code === "23505") return { error: "Another contact already uses that email.", ok: false };
    return { error: error.message, ok: false };
  }
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Send a one-off SMS to the contact and log it. Reuses the conversations helper,
// which enforces Twilio config, a valid mobile, and STOP/opt-out.
export async function sendContactSms(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const contactId = String(formData.get("contactId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!contactId || !body) return { error: "Write a message first.", ok: false };
  const res = await sendConversationSms(contactId, body);
  if (!res.ok) return { error: res.error ?? "Couldn't send the text.", ok: false };
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Add a freeform tag to a contact (e.g. "vip", "franchise-lead").
export async function addContactTag(contactId: string, tag: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const t = tag.trim().slice(0, 40);
  if (!contactId || !t) return { error: "Enter a tag.", ok: false };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("tags").eq("id", contactId).maybeSingle();
  const cur = ((c as { tags: string[] | null } | null)?.tags) ?? [];
  if (cur.includes(t)) return { error: null, ok: true };
  const { error } = await admin.from("crm_contacts").update({ tags: [...cur, t], updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { error: error.message, ok: false };
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Remove a tag from a contact.
export async function removeContactTag(contactId: string, tag: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  if (!contactId || !tag) return { error: "Missing tag.", ok: false };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("tags").eq("id", contactId).maybeSingle();
  const cur = ((c as { tags: string[] | null } | null)?.tags) ?? [];
  const { error } = await admin.from("crm_contacts").update({ tags: cur.filter((x) => x !== tag), updated_at: new Date().toISOString() }).eq("id", contactId);
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
// enrollments cascade via FK). Requires the crm_delete capability — sales agents
// have CRM access to view/add/edit but not delete. Redirects back to the pipeline.
export async function deleteContact(contactId: string): Promise<void> {
  const me = await platformSectionActor("crm_delete");
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

// Manually create a contact, then open it. Email is required + unique.
export async function createContact(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const stageRaw = String(formData.get("stage") || "new");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address.", ok: false };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crm_contacts")
    .insert({ email, name, phone, stage: isCrmStage(stageRaw) ? stageRaw : "new", first_source: "manual", tags: ["src:manual"] })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "A contact with that email already exists.", ok: false };
    return { error: error.message, ok: false };
  }
  revalidatePath("/admin/crm");
  redirect(`/admin/crm/${(data as { id: string }).id}`);
}

// Bulk-import contacts (parsed client-side from CSV). Upserts by email:
// new emails are inserted; existing ones get name/phone filled in if blank.
export async function importContacts(
  rows: { email: string; name?: string | null; phone?: string | null }[],
): Promise<{ ok: boolean; imported: number; updated: number; skipped: number; error?: string }> {
  const me = await platformSectionActor("crm");
  if (!me) return { ok: false, imported: 0, updated: 0, skipped: 0, error: "Not authorized." };
  const admin = createAdminClient();
  const capped = rows.slice(0, 2000);
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const nowIso = new Date().toISOString();
  for (const r of capped) {
    const email = String(r.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      skipped++;
      continue;
    }
    const name = (r.name ?? "").toString().trim() || null;
    const phone = (r.phone ?? "").toString().trim() || null;
    const { data: existing } = await admin.from("crm_contacts").select("id, name, phone").eq("email", email).maybeSingle();
    const ex = existing as { id: string; name: string | null; phone: string | null } | null;
    if (ex) {
      const upd: Record<string, unknown> = { updated_at: nowIso };
      if (name && !ex.name) upd.name = name;
      if (phone && !ex.phone) upd.phone = phone;
      if (Object.keys(upd).length > 1) {
        await admin.from("crm_contacts").update(upd).eq("id", ex.id);
        updated++;
      } else {
        skipped++;
      }
    } else {
      const { error } = await admin.from("crm_contacts").insert({ email, name, phone, first_source: "import", tags: ["src:import"] });
      if (error) skipped++;
      else imported++;
    }
  }
  revalidatePath("/admin/crm");
  return { ok: true, imported, updated, skipped };
}

// Set/replace a user-authored custom field on a contact (stored in fields jsonb).
export async function setContactField(contactId: string, key: string, value: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  const k = key.trim().slice(0, 60);
  if (!contactId || !k) return { error: "Field name is required.", ok: false };
  if (!isCustomContactField(k)) return { error: "That field name is reserved.", ok: false };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("fields").eq("id", contactId).maybeSingle();
  const fields = { ...((c as { fields: Record<string, unknown> | null } | null)?.fields ?? {}) };
  fields[k] = value.trim();
  const { error } = await admin.from("crm_contacts").update({ fields, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { error: error.message, ok: false };
  revalidatePath(`/admin/crm/${contactId}`);
  return { error: null, ok: true };
}

// Remove a custom field from a contact.
export async function removeContactField(contactId: string, key: string): Promise<CrmActionState> {
  const me = await platformSectionActor("crm");
  if (!me) return { error: "Not authorized.", ok: false };
  if (!contactId || !key) return { error: "Missing field.", ok: false };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("fields").eq("id", contactId).maybeSingle();
  const fields = { ...((c as { fields: Record<string, unknown> | null } | null)?.fields ?? {}) };
  delete fields[key];
  const { error } = await admin.from("crm_contacts").update({ fields, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { error: error.message, ok: false };
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

  // Use the shared sequence wrapper so even one-off emails carry the CAN-SPAM
  // unsubscribe footer + postal address.
  const html = buildSequenceEmailHtml(finalBody, c.email);

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
