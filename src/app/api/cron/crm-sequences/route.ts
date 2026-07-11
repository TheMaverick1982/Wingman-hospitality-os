import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildSequenceEmailHtml } from "@/lib/crm-sequences";
import { renderMerge, CRM_REPLY_TO } from "@/lib/crm-merge";

// Runs hourly. Sends due nurture/onboarding steps, honoring:
//   - draft/publish (drafts never send)
//   - stop conditions (unsubscribed / booked / customer / paused)
//   - the send window (Mon–Sat 07:00–19:00 ET) unless the step is transactional
//   - per-step send conditions (activated / not_activated) for the WF-05 split
//   - {{merge}} fields + Reply-To hello@joinwingman.app
export const maxDuration = 60;

const SEND_TZ = "America/New_York";

type Enrollment = {
  id: string;
  sequence_id: string;
  contact_id: string;
  next_step_order: number;
  enrolled_at: string;
  crm_contacts: { email: string; name: string | null; unsubscribed: boolean; booked_at: string | null; customer_at: string | null; org_id: string | null; fields: Record<string, unknown> | null } | null;
  crm_sequences: { source: string; active: boolean; published: boolean } | null;
};
type Step = { step_order: number; delay_days: number; subject: string; body: string; send_condition: string; transactional: boolean };

function inSendWindow(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: SEND_TZ, weekday: "short", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return weekday !== "Sun" && hour >= 7 && hour < 19;
}

// "Activated" = the customer has started using Wingman (wizard/AI content, staff,
// or an invited teammate). Drives the WF-05 activated/rescue split.
async function isActivated(admin: ReturnType<typeof createAdminClient>, orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  const [{ data: org }, { count: standards }, { count: staff }, { count: profiles }] = await Promise.all([
    admin.from("organizations").select("system_generated").eq("id", orgId).maybeSingle(),
    admin.from("department_standards").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    admin.from("staff_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  return Boolean((org as { system_generated?: boolean } | null)?.system_generated) || (standards ?? 0) > 0 || (staff ?? 0) > 0 || (profiles ?? 0) > 1;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowOpen = inSendWindow();

  const { data, error } = await admin
    .from("crm_enrollments")
    .select("id, sequence_id, contact_id, next_step_order, enrolled_at, crm_contacts(email, name, unsubscribed, booked_at, customer_at, org_id, fields), crm_sequences(source, active, published)")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(120);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (data ?? []) as unknown as Enrollment[];
  let sent = 0;
  let stopped = 0;
  let completed = 0;
  let held = 0;

  for (const e of due) {
    const contact = e.crm_contacts;
    const seq = e.crm_sequences;
    if (!contact || !seq) continue;

    // Draft/unpublished → hold (don't send, don't advance); re-checked next run.
    if (!seq.published) continue;

    // Hard stops.
    if (contact.unsubscribed || contact.booked_at || contact.customer_at || !seq.active) {
      const reason = contact.unsubscribed ? "unsubscribed" : contact.booked_at ? "booked" : contact.customer_at ? "customer" : "paused";
      await admin.from("crm_enrollments").update({ status: "stopped", stopped_reason: reason, updated_at: nowIso }).eq("id", e.id);
      stopped++;
      continue;
    }

    const { data: stepRows } = await admin
      .from("crm_sequence_steps")
      .select("step_order, delay_days, subject, body, send_condition, transactional")
      .eq("sequence_id", e.sequence_id)
      .eq("active", true)
      .order("step_order", { ascending: true });
    const steps = (stepRows ?? []) as Step[];

    // Resolve the next sendable step: skip past not-yet-due, and skip steps whose
    // send_condition doesn't match (the "other arm" of a conditional day).
    let activated: boolean | null = null;
    let ptr = e.next_step_order;
    let toSend: Step | null = null;
    let terminal: "complete" | "reschedule" | null = null;
    let rescheduleAt = nowIso;

    for (;;) {
      const step = steps.find((s) => s.step_order >= ptr);
      if (!step) {
        terminal = "complete";
        break;
      }
      const dueAt = new Date(e.enrolled_at).getTime() + step.delay_days * 86400000;
      if (dueAt > now) {
        terminal = "reschedule";
        rescheduleAt = new Date(dueAt).toISOString();
        ptr = step.step_order;
        break;
      }
      if (step.send_condition !== "always") {
        if (activated === null) activated = await isActivated(admin, contact.org_id);
        const ok = step.send_condition === "activated" ? activated : !activated;
        if (!ok) {
          ptr = step.step_order + 1;
          continue;
        }
      }
      toSend = step;
      ptr = step.step_order;
      break;
    }

    if (terminal === "complete") {
      await admin.from("crm_enrollments").update({ status: "completed", next_step_order: ptr, updated_at: nowIso }).eq("id", e.id);
      completed++;
      continue;
    }
    if (terminal === "reschedule" || !toSend) {
      await admin.from("crm_enrollments").update({ next_step_order: ptr, next_run_at: rescheduleAt, updated_at: nowIso }).eq("id", e.id);
      continue;
    }

    // Send-window hold for non-transactional emails.
    if (!toSend.transactional && !windowOpen) {
      await admin.from("crm_enrollments").update({ next_step_order: toSend.step_order, updated_at: nowIso }).eq("id", e.id);
      held++;
      continue;
    }

    const subject = renderMerge(toSend.subject, contact);
    const body = renderMerge(toSend.body, contact);
    try {
      await sendEmail({ to: [contact.email], subject, html: buildSequenceEmailHtml(body, contact.email), replyTo: CRM_REPLY_TO });
    } catch (err) {
      console.error("[crm] sequence send failed", err);
      await admin.from("crm_enrollments").update({ next_step_order: toSend.step_order, updated_at: nowIso }).eq("id", e.id);
      continue;
    }
    sent++;

    await admin.from("crm_activities").insert({
      contact_id: e.contact_id,
      kind: "email_out",
      subject,
      body,
      meta: { sequence: seq.source, automated: true, to: contact.email },
    });
    await admin.from("crm_contacts").update({ last_activity_at: nowIso }).eq("id", e.contact_id);

    const next = steps.find((s) => s.step_order > toSend!.step_order);
    if (next) {
      const nextDue = new Date(new Date(e.enrolled_at).getTime() + next.delay_days * 86400000).toISOString();
      await admin.from("crm_enrollments").update({ next_step_order: next.step_order, next_run_at: nextDue, updated_at: nowIso }).eq("id", e.id);
    } else {
      await admin.from("crm_enrollments").update({ status: "completed", updated_at: nowIso }).eq("id", e.id);
      completed++;
    }
  }

  return NextResponse.json({ processed: due.length, sent, stopped, completed, held, windowOpen });
}
