"use server";

import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { renderMerge, CRM_REPLY_TO } from "@/lib/crm-merge";
import { buildSequenceEmailHtml } from "@/lib/crm-sequences";

export type BroadcastState = { error: string | null; sent: number | null; skipped: number | null };

// Safety cap per send so a broadcast can't blow the Resend quota or time out.
const MAX_RECIPIENTS = 500;

type Contact = { id: string; email: string; name: string | null; fields: Record<string, unknown> | null; unsubscribed: boolean | null };

// Send a one-off broadcast to every CRM contact carrying ANY of the selected
// tags, minus anyone unsubscribed or on the suppression list. Reply-To is
// hello@joinwingman.app; each send is logged on the contact's timeline.
export async function sendBroadcast(_prev: BroadcastState, formData: FormData): Promise<BroadcastState> {
  if (!(await platformSectionActor("crm"))) return { error: "Not authorized.", sent: null, skipped: null };

  const tags = formData.getAll("tags").map((t) => String(t)).filter(Boolean);
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const test = String(formData.get("test") || "") === "on";
  const testEmail = String(formData.get("testEmail") || "").trim().toLowerCase();

  if (tags.length === 0) return { error: "Pick at least one tag.", sent: null, skipped: null };
  if (!subject) return { error: "Add a subject.", sent: null, skipped: null };
  if (!body) return { error: "Write a message.", sent: null, skipped: null };

  const admin = createAdminClient();

  // Test send: just email the tester, no logging, no contact fan-out.
  if (test) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail)) return { error: "Enter a valid test email.", sent: null, skipped: null };
    const html = buildSequenceEmailHtml(renderMerge(body, { name: "there", fields: {} }), testEmail);
    try {
      await sendEmail({ to: [testEmail], subject: renderMerge(subject, { name: "there", fields: {} }), html, replyTo: CRM_REPLY_TO });
    } catch (e) {
      return { error: `Test send failed: ${(e as Error).message}`, sent: null, skipped: null };
    }
    return { error: null, sent: 1, skipped: 0 };
  }

  // Match ANY of the selected tags.
  const { data: rows } = await admin
    .from("crm_contacts")
    .select("id, email, name, fields, unsubscribed")
    .overlaps("tags", tags)
    .limit(MAX_RECIPIENTS + 1);
  const contacts = (rows ?? []) as Contact[];

  // Suppression list — never email these.
  const { data: suppRows } = await admin.from("crm_suppression").select("email");
  const suppressed = new Set(((suppRows ?? []) as { email: string }[]).map((s) => s.email.toLowerCase()));

  const eligible = contacts.filter((c) => c.email && !c.unsubscribed && !suppressed.has(c.email.toLowerCase()));
  const truncated = eligible.length > MAX_RECIPIENTS;
  const targets = eligible.slice(0, MAX_RECIPIENTS);

  let sent = 0;
  const nowIso = new Date().toISOString();
  for (const c of targets) {
    const merged = { name: c.name, fields: c.fields };
    const subj = renderMerge(subject, merged);
    const html = buildSequenceEmailHtml(renderMerge(body, merged), c.email);
    try {
      await sendEmail({ to: [c.email], subject: subj, html, replyTo: CRM_REPLY_TO });
      sent++;
      await admin.from("crm_activities").insert({
        contact_id: c.id,
        kind: "email_out",
        subject: subj,
        body: renderMerge(body, merged),
        meta: { broadcast: true, tags, to: c.email },
      });
      await admin.from("crm_contacts").update({ last_activity_at: nowIso }).eq("id", c.id);
    } catch (e) {
      console.error("[crm] broadcast send failed", c.email, e);
    }
  }

  const skipped = contacts.length - sent;
  return {
    error: truncated ? `Sent to the first ${MAX_RECIPIENTS} — more matched than the per-send cap. Narrow the tags or send again.` : null,
    sent,
    skipped,
  };
}
