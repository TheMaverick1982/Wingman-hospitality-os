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

// Enroll a contact into the sequence for their lead source, if one is active,
// they're not suppressed, and they're not already enrolled. Best-effort.
export async function enrollContactInSource(contactId: string, email: string, source: string, adminArg?: Admin): Promise<void> {
  const admin = adminArg ?? createAdminClient();
  const lower = email.toLowerCase();

  const { data: supp } = await admin.from("crm_suppression").select("email").eq("email", lower).maybeSingle();
  if (supp) return;

  const { data: seq } = await admin.from("crm_sequences").select("id, active").eq("source", source).maybeSingle();
  const s = seq as { id: string; active: boolean } | null;
  if (!s || !s.active) return;

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
  const { data: c } = await admin.from("crm_contacts").select("id").eq("email", lower).maybeSingle();
  const contact = c as { id: string } | null;
  if (!contact) return false;
  const now = new Date().toISOString();
  await admin.from("crm_contacts").update({ booked_at: now, last_activity_at: now, updated_at: now }).eq("id", contact.id);
  await stopEnrollments(contact.id, "booked", admin);
  await admin.from("crm_activities").insert({ contact_id: contact.id, kind: "system", body: "Booked a call — sequences stopped" });
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
