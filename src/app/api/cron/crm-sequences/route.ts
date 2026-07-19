import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildSequenceEmailHtml } from "@/lib/crm-sequences";
import { renderMerge, CRM_REPLY_TO } from "@/lib/crm-merge";
import { getPlatformPricing, applyPriceTokens } from "@/lib/pricing";
import { withFirstSmsOptOut } from "@/lib/sms-optout";
import { resolveStep } from "@/lib/crm-step-resolver";
import { sendSms, normalizePhone, twilioConfigured } from "@/lib/calendar/sms";

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
  crm_contacts: { email: string; name: string | null; phone: string | null; unsubscribed: boolean; sms_marketing_consent: boolean; sms_opt_out: boolean; booked_at: string | null; customer_at: string | null; org_id: string | null; fields: Record<string, unknown> | null } | null;
  crm_sequences: { source: string; active: boolean; published: boolean } | null;
};
type Step = { step_order: number; delay_days: number; channel: string; subject: string; body: string; send_condition: string; transactional: boolean };

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
  // Held/failed enrollments are pushed ~1h out so they leave the due window for
  // this run (retried next hour). This is what lets the drain loop below re-fetch
  // fresh rows each pass without ever spinning on the same ones.
  const retryIso = new Date(now + 3_600_000).toISOString();

  // Drain the backlog within the run rather than capping at one batch/hour.
  // Bounded by a wall-clock budget (well under maxDuration) and a hard batch cap.
  const BATCH = 150;
  const TIME_BUDGET_MS = 50_000;
  const MAX_BATCHES = 60;

  let processed = 0;
  let sent = 0;
  let smsSent = 0;
  let smsSkipped = 0;
  let stopped = 0;
  let completed = 0;
  let held = 0;
  let capped = false;

  for (let batchNo = 0; batchNo < MAX_BATCHES; batchNo++) {
    const { data, error } = await admin
      .from("crm_enrollments")
      .select("id, sequence_id, contact_id, next_step_order, enrolled_at, crm_contacts(email, name, phone, unsubscribed, sms_marketing_consent, sms_opt_out, booked_at, customer_at, org_id, fields), crm_sequences(source, active, published)")
      .eq("status", "active")
      .lte("next_run_at", nowIso)
      .order("next_run_at", { ascending: true })
      .limit(BATCH);
    if (error) {
      if (processed === 0) return NextResponse.json({ error: error.message }, { status: 500 });
      console.error("[crm] batch fetch failed mid-run", error.message);
      break;
    }
    const due = (data ?? []) as unknown as Enrollment[];
    if (due.length === 0) break;

  // Live pricing so {{firstPrice}}/{{addlPrice}} in any step render the current
  // configured price — automations never quote a stale number.
  const pricing = await getPlatformPricing();

  for (const e of due) {
    const contact = e.crm_contacts;
    const seq = e.crm_sequences;
    if (!contact || !seq) continue;

    // Draft/unpublished → hold (don't send, don't advance); re-checked next run.
    if (!seq.published) {
      await admin.from("crm_enrollments").update({ next_run_at: retryIso, updated_at: nowIso }).eq("id", e.id);
      continue;
    }

    // Customer-oriented sequences (signup onboarding, referral) are FOR customers,
    // so becoming a customer / booking a demo must NOT stop them — only unsubscribe
    // (or pausing the sequence) does. Nurtures still stop on booked/customer.
    const customerSeq = seq.source === "signup" || seq.source === "referral" || seq.source === "reactivation";
    const wonStop = !customerSeq && (contact.booked_at != null || contact.customer_at != null);

    // Hard stops.
    if (contact.unsubscribed || wonStop || !seq.active) {
      const reason = contact.unsubscribed ? "unsubscribed" : contact.booked_at ? "booked" : contact.customer_at ? "customer" : "paused";
      await admin.from("crm_enrollments").update({ status: "stopped", stopped_reason: reason, updated_at: nowIso }).eq("id", e.id);
      stopped++;
      continue;
    }

    const { data: stepRows } = await admin
      .from("crm_sequence_steps")
      .select("step_order, delay_days, channel, subject, body, send_condition, transactional")
      .eq("sequence_id", e.sequence_id)
      .eq("active", true)
      .order("step_order", { ascending: true });
    const steps = (stepRows ?? []) as Step[];

    // Resolve the next sendable step (pure logic in crm-step-resolver). Only pay
    // for the activation check when a conditional step still lies ahead.
    const enrolledMs = new Date(e.enrolled_at).getTime();
    const hasConditional = steps.some((s) => s.step_order >= e.next_step_order && s.send_condition !== "always");
    const activated = hasConditional ? await isActivated(admin, contact.org_id) : false;
    const decision = resolveStep(steps, e.next_step_order, now - enrolledMs, activated);

    if (decision.action === "complete") {
      await admin.from("crm_enrollments").update({ status: "completed", next_step_order: decision.lastOrder, updated_at: nowIso }).eq("id", e.id);
      completed++;
      continue;
    }
    if (decision.action === "reschedule") {
      const rescheduleAt = new Date(enrolledMs + decision.atMs).toISOString();
      await admin.from("crm_enrollments").update({ next_step_order: decision.nextOrder, next_run_at: rescheduleAt, updated_at: nowIso }).eq("id", e.id);
      continue;
    }
    const toSend = decision.step as Step;

    // Send-window hold for non-transactional emails.
    if (!toSend.transactional && !windowOpen) {
      await admin.from("crm_enrollments").update({ next_step_order: toSend.step_order, next_run_at: retryIso, updated_at: nowIso }).eq("id", e.id);
      held++;
      continue;
    }

    // Advance to the next step (or complete). Shared by both channels.
    const advance = async () => {
      const next = steps.find((s) => s.step_order > toSend.step_order);
      if (next) {
        const nextDue = new Date(new Date(e.enrolled_at).getTime() + next.delay_days * 86400000).toISOString();
        await admin.from("crm_enrollments").update({ next_step_order: next.step_order, next_run_at: nextDue, updated_at: nowIso }).eq("id", e.id);
      } else {
        await admin.from("crm_enrollments").update({ status: "completed", updated_at: nowIso }).eq("id", e.id);
        completed++;
      }
    };

    // SMS step: gated on Twilio being configured + a phone + explicit marketing SMS
    // consent + not opted out (A2P/TCPA). If the contact isn't eligible we skip the
    // step and move on rather than stalling the whole sequence on it.
    if (toSend.channel === "sms") {
      const phone = normalizePhone(contact.phone ?? "");
      const eligible = twilioConfigured() && Boolean(phone) && contact.sms_marketing_consent && !contact.sms_opt_out;
      if (!eligible) {
        smsSkipped++;
        await advance();
        continue;
      }
      const smsBody = await withFirstSmsOptOut(admin, e.contact_id, applyPriceTokens(renderMerge(toSend.body, contact), pricing));
      const res = await sendSms(phone, smsBody);
      if (!res.ok) {
        // Best-effort: a single number failing (e.g. carrier-blocked, opted out at
        // the carrier level) must not stall the sequence's later steps. Skip past
        // this SMS instead of holding, and log it.
        console.error("[crm] sequence sms failed", res.error);
        smsSkipped++;
        await advance();
        continue;
      }
      smsSent++;
      await admin.from("crm_activities").insert({
        contact_id: e.contact_id,
        kind: "sms_out",
        subject: "",
        body: smsBody,
        meta: { sequence: seq.source, automated: true, to: phone, channel: "sms" },
      });
      await admin.from("crm_contacts").update({ last_activity_at: nowIso }).eq("id", e.contact_id);
      await advance();
      continue;
    }

    const subject = applyPriceTokens(renderMerge(toSend.subject, contact), pricing);
    const body = applyPriceTokens(renderMerge(toSend.body, contact), pricing);
    try {
      await sendEmail({ to: [contact.email], subject, html: buildSequenceEmailHtml(body, contact.email), replyTo: CRM_REPLY_TO });
    } catch (err) {
      console.error("[crm] sequence send failed", err);
      await admin.from("crm_enrollments").update({ next_step_order: toSend.step_order, next_run_at: retryIso, updated_at: nowIso }).eq("id", e.id);
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

    await advance();
  }

    processed += due.length;
    if (due.length < BATCH) break; // fully drained the due backlog
    if (Date.now() - now > TIME_BUDGET_MS) {
      capped = true;
      break;
    }
  }

  if (capped) console.warn(`[crm] time budget hit after ${processed} due steps — backlog remains, resumes next run`);

  return NextResponse.json({ processed, sent, smsSent, smsSkipped, stopped, completed, held, windowOpen, capped });
}
