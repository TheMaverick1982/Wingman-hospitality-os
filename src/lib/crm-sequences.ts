import "server-only";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side engine for CRM nurture sequences (Phase 1B). Enrollment, stop
// conditions (booked / customer / unsubscribed), and the email HTML + unsub link.
// All access is via the service-role admin client (deny-all RLS on the tables).

type Admin = ReturnType<typeof createAdminClient>;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";
const UNSUB_SECRET = process.env.CRON_SECRET ?? "wingman-unsub-secret";
const MAILING_ADDRESS = process.env.CRM_MAILING_ADDRESS ?? "The Maverick Agency";

export function unsubSignature(email: string): string {
  return createHmac("sha256", UNSUB_SECRET).update(email.toLowerCase()).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(email: string): string {
  return `${SITE_URL}/api/crm/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&sig=${unsubSignature(email)}`;
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

// Escape → linkify bare URLs → newlines to <br>, then append a CAN-SPAM footer
// (unsubscribe link + postal address).
export function buildSequenceEmailHtml(body: string, email: string): string {
  const inner = esc(body)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#c0392b;">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:560px;">
    <div>${inner}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px;">
    <p style="font-size:12px;color:#999;line-height:1.5;">
      You're receiving this because you reached out to Wingman. <a href="${unsubscribeUrl(email)}" style="color:#999;">Unsubscribe</a>.<br>
      ${esc(MAILING_ADDRESS)}
    </p>
  </div>`;
}

// Enroll a contact into the sequence for their lead source, subject to the spec's
// global entry guards. Best-effort. A contact is NOT enrolled if they:
//   - are suppressed / unsubscribed,
//   - are already a customer or have booked a demo (never nurture won leads),
//   - already have an active nurture running (one nurture at a time),
//   - already ran this exact sequence (no re-entry — a resubmission only refreshes
//     their fields, which happens upstream in captureLead before this call),
//   - the sequence is missing, inactive, or a draft.
// Any lead-field updates are applied by the caller before this runs, so "abort"
// here simply means "return without enrolling".
export async function enrollContactInSource(contactId: string, email: string, source: string, adminArg?: Admin): Promise<void> {
  const admin = adminArg ?? createAdminClient();
  const lower = email.toLowerCase();

  const { data: supp } = await admin.from("crm_suppression").select("email").eq("email", lower).maybeSingle();
  if (supp) return;

  // Entry guards from the contact's current state.
  const { data: c } = await admin
    .from("crm_contacts")
    .select("stage, booked_at, customer_at, unsubscribed, tags")
    .eq("id", contactId)
    .maybeSingle();
  const contact = c as {
    stage: string | null;
    booked_at: string | null;
    customer_at: string | null;
    unsubscribed: boolean | null;
    tags: string[] | null;
  } | null;
  if (!contact || contact.unsubscribed) return;
  const tags = contact.tags ?? [];
  const isCustomer = contact.customer_at != null || contact.stage === "signed_up" || tags.includes("status:customer");
  const isBooked =
    contact.booked_at != null ||
    contact.stage === "demoed" ||
    contact.stage === "demo_completed" ||
    tags.includes("status:demo-booked");
  if (isCustomer || isBooked) return; // won leads never re-enter nurture

  // One nurture at a time: skip if any active enrollment already exists.
  const { data: active } = await admin
    .from("crm_enrollments")
    .select("id")
    .eq("contact_id", contactId)
    .eq("status", "active")
    .limit(1);
  if ((active ?? []).length) return;

  const { data: seq } = await admin.from("crm_sequences").select("id, active, published").eq("source", source).maybeSingle();
  const s = seq as { id: string; active: boolean; published: boolean } | null;
  if (!s || !s.active || !s.published) return; // drafts never enroll/send

  // No re-entry: skip if they ever enrolled in THIS sequence (any status).
  const { data: prior } = await admin
    .from("crm_enrollments")
    .select("id")
    .eq("contact_id", contactId)
    .eq("sequence_id", s.id)
    .limit(1);
  if ((prior ?? []).length) return;

  const { data: steps } = await admin
    .from("crm_sequence_steps")
    .select("step_order, delay_days")
    .eq("sequence_id", s.id)
    .eq("active", true)
    .order("step_order", { ascending: true })
    .limit(1);
  const first = (steps ?? [])[0] as { step_order: number; delay_days: number } | undefined;
  if (!first) return;

  const now = new Date();
  const nextRun = new Date(now.getTime() + first.delay_days * 86400000).toISOString();
  await admin.from("crm_enrollments").upsert(
    {
      contact_id: contactId,
      sequence_id: s.id,
      status: "active",
      next_step_order: first.step_order,
      next_run_at: nextRun,
      enrolled_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "contact_id,sequence_id", ignoreDuplicates: true }
  );
}

export async function stopEnrollments(contactId: string, reason: string, adminArg?: Admin): Promise<void> {
  const admin = adminArg ?? createAdminClient();
  await admin
    .from("crm_enrollments")
    .update({ status: "stopped", stopped_reason: reason, updated_at: new Date().toISOString() })
    .eq("contact_id", contactId)
    .eq("status", "active");
}

// Mark a contact as having booked a call — stops all their sequences.
export async function markBookedByEmail(email: string, adminArg?: Admin): Promise<boolean> {
  const admin = adminArg ?? createAdminClient();
  const lower = email.toLowerCase();
  const { data: c } = await admin.from("crm_contacts").select("id, stage").eq("email", lower).maybeSingle();
  const contact = c as { id: string; stage: string } | null;
  if (!contact) return false;
  const now = new Date().toISOString();
  // Booking a call auto-advances them to Demo (unless already won/lost).
  const keepStage = contact.stage === "signed_up" || contact.stage === "lost";
  const stage = keepStage ? contact.stage : "demoed";
  await admin.from("crm_contacts").update({ booked_at: now, stage, last_activity_at: now, updated_at: now }).eq("id", contact.id);
  await stopEnrollments(contact.id, "booked", admin);
  await admin.from("crm_activities").insert({
    contact_id: contact.id,
    kind: "system",
    body: keepStage ? "Booked a call — sequences stopped" : "Booked a call — moved to Demo, sequences stopped",
  });
  return true;
}

// Mark a signup as a customer — creates the contact if new, marks them won, and
// stops their sequences. Best-effort; never blocks signup.
export async function markCustomerByEmail(email: string, orgId?: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const lower = email.toLowerCase();
    const now = new Date().toISOString();
    const { data: c } = await admin.from("crm_contacts").select("id").eq("email", lower).maybeSingle();
    let contactId = (c as { id: string } | null)?.id;
    if (contactId) {
      await admin.from("crm_contacts").update({ stage: "signed_up", customer_at: now, org_id: orgId ?? null, last_activity_at: now, updated_at: now }).eq("id", contactId);
    } else {
      const { data: created } = await admin
        .from("crm_contacts")
        .insert({ email: lower, stage: "signed_up", customer_at: now, org_id: orgId ?? null, first_source: "signup", last_activity_at: now })
        .select("id")
        .single();
      contactId = (created as { id: string } | null)?.id;
    }
    if (contactId) {
      await stopEnrollments(contactId, "customer", admin);
      await admin.from("crm_activities").insert({ contact_id: contactId, kind: "system", body: "Became a customer — sequences stopped" });
    }
  } catch (e) {
    console.error("[crm] markCustomerByEmail failed", e);
  }
}

export async function suppressEmail(email: string, reason: string, adminArg?: Admin): Promise<void> {
  const admin = adminArg ?? createAdminClient();
  const lower = email.toLowerCase();
  await admin.from("crm_suppression").upsert({ email: lower, reason }, { onConflict: "email", ignoreDuplicates: true });
  const { data: c } = await admin.from("crm_contacts").select("id").eq("email", lower).maybeSingle();
  const contact = c as { id: string } | null;
  if (contact) {
    await admin.from("crm_contacts").update({ unsubscribed: true, updated_at: new Date().toISOString() }).eq("id", contact.id);
    await stopEnrollments(contact.id, "unsubscribed", admin);
    await admin.from("crm_activities").insert({ contact_id: contact.id, kind: "system", body: "Unsubscribed" });
  }
}
