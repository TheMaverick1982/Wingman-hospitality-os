import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildSequenceEmailHtml } from "@/lib/crm-sequences";

// Runs daily. Sends any due nurture-sequence step, honoring stop conditions
// (unsubscribed / booked a call / became a customer / sequence turned off).
export const maxDuration = 60;

type Enrollment = {
  id: string;
  sequence_id: string;
  contact_id: string;
  next_step_order: number;
  enrolled_at: string;
  crm_contacts: { email: string; unsubscribed: boolean; booked_at: string | null; customer_at: string | null } | null;
  crm_sequences: { source: string; active: boolean } | null;
};
type Step = { step_order: number; delay_days: number; subject: string; body: string };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data, error } = await admin
    .from("crm_enrollments")
    .select("id, sequence_id, contact_id, next_step_order, enrolled_at, crm_contacts(email, unsubscribed, booked_at, customer_at), crm_sequences(source, active)")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(80);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (data ?? []) as unknown as Enrollment[];
  let sent = 0;
  let stopped = 0;
  let completed = 0;

  for (const e of due) {
    const contact = e.crm_contacts;
    const seq = e.crm_sequences;
    if (!contact || !seq) continue;

    // Stop conditions.
    if (contact.unsubscribed || contact.booked_at || contact.customer_at || !seq.active) {
      const reason = contact.unsubscribed ? "unsubscribed" : contact.booked_at ? "booked" : contact.customer_at ? "customer" : "inactive";
      await admin.from("crm_enrollments").update({ status: "stopped", stopped_reason: reason, updated_at: nowIso }).eq("id", e.id);
      stopped++;
      continue;
    }

    const { data: stepRows } = await admin
      .from("crm_sequence_steps")
      .select("step_order, delay_days, subject, body")
      .eq("sequence_id", e.sequence_id)
      .eq("active", true)
      .order("step_order", { ascending: true });
    const steps = (stepRows ?? []) as Step[];
    const current = steps.find((s) => s.step_order >= e.next_step_order);
    if (!current) {
      await admin.from("crm_enrollments").update({ status: "completed", updated_at: nowIso }).eq("id", e.id);
      completed++;
      continue;
    }

    const dueAt = new Date(e.enrolled_at).getTime() + current.delay_days * 86400000;
    if (dueAt > now) {
      // Not due yet (e.g. an earlier step was deactivated) — reschedule.
      await admin.from("crm_enrollments").update({ next_run_at: new Date(dueAt).toISOString(), next_step_order: current.step_order, updated_at: nowIso }).eq("id", e.id);
      continue;
    }

    try {
      await sendEmail({ to: [contact.email], subject: current.subject, html: buildSequenceEmailHtml(current.body, contact.email) });
    } catch (err) {
      // Leave the enrollment due; it retries next run (e.g. hit a daily send cap).
      console.error("[crm] sequence send failed", err);
      continue;
    }
    sent++;

    await admin.from("crm_activities").insert({
      contact_id: e.contact_id,
      kind: "email_out",
      subject: current.subject,
      body: current.body,
      meta: { sequence: seq.source, automated: true, to: contact.email },
    });
    await admin.from("crm_contacts").update({ last_activity_at: nowIso }).eq("id", e.contact_id);

    const next = steps.find((s) => s.step_order > current.step_order);
    if (next) {
      const nextDue = new Date(new Date(e.enrolled_at).getTime() + next.delay_days * 86400000).toISOString();
      await admin.from("crm_enrollments").update({ next_step_order: next.step_order, next_run_at: nextDue, updated_at: nowIso }).eq("id", e.id);
    } else {
      await admin.from("crm_enrollments").update({ status: "completed", updated_at: nowIso }).eq("id", e.id);
      completed++;
    }
  }

  return NextResponse.json({ processed: due.length, sent, stopped, completed });
}
