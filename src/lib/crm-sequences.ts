import "server-only";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeFirstName } from "@/lib/name-safety";

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
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0a6cff;">$1</a>')
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
export async function enrollContactInSource(
  contactId: string,
  email: string,
  source: string,
  adminArg?: Admin,
  opts?: { ignoreWonGuards?: boolean }
): Promise<void> {
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
  // The won-lead guards don't apply to the signup onboarding sequence — becoming
  // a customer is exactly what starts it. (ignoreWonGuards is set by that path.)
  if (!opts?.ignoreWonGuards) {
    const isCustomer = contact.customer_at != null || contact.stage === "signed_up" || tags.includes("status:customer");
    const isBooked =
      contact.booked_at != null ||
      contact.stage === "demoed" ||
      contact.stage === "demo_completed" ||
      tags.includes("status:demo-booked");
    if (isCustomer || isBooked) return; // won leads never re-enter nurture
  }

  // One nurture at a time: skip if any active enrollment already exists. Doesn't
  // apply to customer sequences (signup onboarding + referral run concurrently).
  if (!opts?.ignoreWonGuards) {
    const { data: active } = await admin
      .from("crm_enrollments")
      .select("id")
      .eq("contact_id", contactId)
      .eq("status", "active")
      .limit(1);
    if ((active ?? []).length) return;
  }

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

// The CRM contact linked to a customer org (org_id is set when they converted).
async function contactForOrg(admin: Admin, orgId: string): Promise<{ id: string; email: string; stage: string } | null> {
  const { data } = await admin
    .from("crm_contacts")
    .select("id, email, stage")
    .eq("org_id", orgId)
    .order("customer_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; email: string; stage: string } | null) ?? null;
}

// On cancellation: move the linked contact to Past Clients and enroll the
// Reactivation win-back sequence (first email fires 30 days out). Best-effort —
// a no-op if the org has no linked CRM contact, and never throws into billing.
export async function markOrgChurned(admin: Admin, orgId: string): Promise<void> {
  try {
    const c = await contactForOrg(admin, orgId);
    if (!c) return;
    const now = new Date().toISOString();
    if (c.stage !== "past_client") {
      await admin.from("crm_contacts").update({ stage: "past_client", last_activity_at: now, updated_at: now }).eq("id", c.id);
      await admin.from("crm_activities").insert({ contact_id: c.id, kind: "system", body: "Subscription canceled — moved to Past Clients" });
    }
    await enrollContactInSource(c.id, c.email, "reactivation", admin, { ignoreWonGuards: true });
  } catch (err) {
    console.error("[crm] markOrgChurned failed", err);
  }
}

// On a successful payment: ensure the linked contact is in Signed Up and stop
// any running Reactivation sequence (they're back). Best-effort.
export async function markOrgPaid(admin: Admin, orgId: string): Promise<void> {
  try {
    const c = await contactForOrg(admin, orgId);
    if (!c || c.stage === "signed_up") return;
    const now = new Date().toISOString();
    await admin.from("crm_contacts").update({ stage: "signed_up", customer_at: now, last_activity_at: now, updated_at: now }).eq("id", c.id);
    await admin.from("crm_activities").insert({ contact_id: c.id, kind: "system", body: "Payment received — moved to Signed Up" });
    await stopEnrollments(c.id, "customer", admin);
  } catch (err) {
    console.error("[crm] markOrgPaid failed", err);
  }
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

// Native calendar → CRM entry point when a demo is booked. Upserts the contact by
// email (creating it if this is a brand-new lead), marks them as booked (advances
// the pipeline + stops any running nurture), and — for non-customers only — enrolls
// the short "Demo Booked — Prep" sequence. Best-effort; never blocks a booking.
export async function recordDemoBooked(input: {
  email: string;
  name?: string;
  phone?: string;
  repUserId?: string | null;
  repName?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const email = (input.email || "").trim().toLowerCase();
    if (!email) return;
    const now = new Date().toISOString();

    // The host rep becomes the contact's lead owner and signs their demo emails
    // ({{rep_name}} / {{rep_first_name}} merge fields resolve from these).
    const repName = (input.repName || "").trim();
    const repFirst = repName ? safeFirstName(repName) ?? repName : "";
    const repFields = repName ? { rep_name: repName, rep_first_name: repFirst } : {};

    const { data: c } = await admin
      .from("crm_contacts")
      .select("id, stage, name, phone, customer_at, fields")
      .eq("email", email)
      .maybeSingle();
    const ex = c as { id: string; stage: string | null; name: string | null; phone: string | null; customer_at: string | null; fields: Record<string, unknown> | null } | null;

    let contactId = ex?.id;
    let isCustomer = ex ? ex.customer_at != null || ex.stage === "signed_up" || ex.stage === "lost" : false;

    if (!contactId) {
      const { data: created } = await admin
        .from("crm_contacts")
        .insert({
          email,
          name: input.name || null,
          phone: input.phone || null,
          first_source: "booked",
          stage: "demoed",
          booked_at: now,
          last_activity_at: now,
          fields: repFields,
          ...(input.repUserId ? { assigned_rep_id: input.repUserId } : {}),
        })
        .select("id")
        .single();
      contactId = (created as { id: string } | null)?.id;
      isCustomer = false;
    } else {
      const stage = isCustomer ? ex!.stage! : "demoed";
      const patch: Record<string, unknown> = { booked_at: now, stage, last_activity_at: now, updated_at: now };
      if (input.name && !ex!.name) patch.name = input.name;
      if (input.phone && !ex!.phone) patch.phone = input.phone;
      // Refresh the rep each booking (a rebook may land on a different host).
      if (repName) patch.fields = { ...(ex!.fields ?? {}), ...repFields };
      if (input.repUserId) patch.assigned_rep_id = input.repUserId;
      await admin.from("crm_contacts").update(patch).eq("id", contactId);
    }
    if (!contactId) return;

    // Booking = engagement: stop any running nurture and log it.
    await stopEnrollments(contactId, "booked", admin);
    await admin.from("crm_activities").insert({ contact_id: contactId, kind: "system", body: "Booked a demo — sequences stopped, prep started" });

    // Demo-prep only for non-customers (a customer booking an onboarding call
    // shouldn't get demo-prep emails).
    if (!isCustomer) {
      await enrollContactInSource(contactId, email, "booked", admin, { ignoreWonGuards: true });
    }
  } catch (e) {
    console.error("[crm] recordDemoBooked failed", e);
  }
}

// Native calendar → CRM entry point when a booked demo is cancelled. Clears the
// booking flag (so a future rebook re-triggers the booked path and won-guards
// don't treat them as won) and enrolls the "Demo Cancel — Re-Book" win-back for
// non-customers. Best-effort.
export async function recordDemoCanceled(email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const lower = (email || "").trim().toLowerCase();
    if (!lower) return;
    const { data: c } = await admin.from("crm_contacts").select("id, stage, customer_at").eq("email", lower).maybeSingle();
    const ex = c as { id: string; stage: string | null; customer_at: string | null } | null;
    if (!ex) return;
    const now = new Date().toISOString();
    await admin.from("crm_contacts").update({ booked_at: null, last_activity_at: now, updated_at: now }).eq("id", ex.id);
    await admin.from("crm_activities").insert({ contact_id: ex.id, kind: "system", body: "Cancelled their demo — re-book sequence started" });
    const isCustomer = ex.customer_at != null || ex.stage === "signed_up" || ex.stage === "lost";
    if (!isCustomer) {
      await enrollContactInSource(ex.id, lower, "demo-cancel", admin, { ignoreWonGuards: true });
    }
  } catch (e) {
    console.error("[crm] recordDemoCanceled failed", e);
  }
}

// Demo happened (appointment marked "showed") — move to Demo Completed. Booking
// already stopped their nurtures; this just advances the pipeline + tags.
export async function markDemoCompletedByEmail(email: string, adminArg?: Admin): Promise<boolean> {
  const admin = adminArg ?? createAdminClient();
  const lower = email.toLowerCase();
  const { data: c } = await admin.from("crm_contacts").select("id, stage, tags").eq("email", lower).maybeSingle();
  const contact = c as { id: string; stage: string; tags: string[] | null } | null;
  if (!contact) return false;
  if (contact.stage === "signed_up" || contact.stage === "lost") return true; // don't regress a won/dead deal
  const now = new Date().toISOString();
  const tags = Array.from(new Set([...(contact.tags ?? []), "status:demo-completed"])).filter((t) => t !== "status:demo-booked" && t !== "status:demo-no-show");
  await admin.from("crm_contacts").update({ stage: "demo_completed", tags, last_activity_at: now, updated_at: now }).eq("id", contact.id);
  await admin.from("crm_activities").insert({ contact_id: contact.id, kind: "system", body: "Demo completed — moved to Demo Completed" });
  return true;
}

// A rep ran a LIVE demo (from the Sales Dashboard / Sales Training). Tie the
// prospect to the rep as their lead owner, advance the pipeline to Demo
// Completed, and log it on the timeline. Resolves the contact by id (existing)
// or by email (creating it if this prospect is brand new). Best-effort — never
// blocks the rep from getting into the demo. Returns the contact id (or null).
export async function attachDemoRun(
  repId: string,
  target: { contactId?: string; email?: string; name?: string },
  adminArg?: Admin
): Promise<string | null> {
  try {
    const admin = adminArg ?? createAdminClient();
    const now = new Date().toISOString();

    // Resolve the contact: prefer an explicit id, else match/create by email.
    let contactId = target.contactId ?? null;
    if (!contactId && target.email) {
      const lower = target.email.toLowerCase();
      const { data: existing } = await admin.from("crm_contacts").select("id").eq("email", lower).maybeSingle();
      contactId = (existing as { id: string } | null)?.id ?? null;
      if (!contactId) {
        const { data: created } = await admin
          .from("crm_contacts")
          .insert({ email: lower, name: target.name || null, first_source: "demo", stage: "new" })
          .select("id")
          .single();
        contactId = (created as { id: string } | null)?.id ?? null;
      }
    }
    if (!contactId) return null;

    const { data: cur } = await admin.from("crm_contacts").select("stage").eq("id", contactId).maybeSingle();
    const stage = (cur as { stage: string } | null)?.stage ?? "new";
    // Never regress a won or dead deal; just re-own it and note the demo.
    const keep = stage === "signed_up" || stage === "lost";

    const update: Record<string, unknown> = {
      assigned_rep_id: repId, // the rep who ran the demo becomes the lead owner
      last_activity_at: now,
      updated_at: now,
    };
    if (!keep) update.stage = "demo_completed";
    if (target.name) update.name = target.name;
    await admin.from("crm_contacts").update(update).eq("id", contactId);
    await admin.from("crm_activities").insert({
      contact_id: contactId,
      kind: "system",
      body: keep ? "Live demo run by their rep" : "Live demo run — moved to Demo Completed",
    });
    return contactId;
  } catch (err) {
    console.error("[crm] attachDemoRun failed", err);
    return null;
  }
}

// Demo no-show — tag them, clear the booking (so a rebook re-triggers Demo Booked
// and the cron stops the follow-up), and start the draft no-show re-engagement.
export async function markDemoNoShowByEmail(email: string, adminArg?: Admin): Promise<boolean> {
  const admin = adminArg ?? createAdminClient();
  const lower = email.toLowerCase();
  const { data: c } = await admin.from("crm_contacts").select("id, stage, tags").eq("email", lower).maybeSingle();
  const contact = c as { id: string; stage: string; tags: string[] | null } | null;
  if (!contact) return false;
  if (contact.stage === "signed_up" || contact.stage === "lost") return true;
  const now = new Date().toISOString();
  const tags = Array.from(new Set([...(contact.tags ?? []), "status:demo-no-show"])).filter((t) => t !== "status:demo-booked");
  await admin.from("crm_contacts").update({ booked_at: null, tags, last_activity_at: now, updated_at: now }).eq("id", contact.id);
  await admin.from("crm_activities").insert({ contact_id: contact.id, kind: "system", body: "Demo no-show — re-engagement started" });
  await enrollContactInSource(contact.id, lower, "demo-no-show", admin, { ignoreWonGuards: true });
  return true;
}

// Mark a signup as a customer — creates the contact if new, marks them won, tags
// them status:customer / src:signup, moves them to Signed Up, MASTER KILL-SWITCH
// stops any running nurture, then enrolls them in the post-signup onboarding
// sequence (wf-05). Best-effort; never blocks signup.
export async function markCustomerByEmail(
  email: string,
  opts?: { orgId?: string; workspaceName?: string; name?: string }
): Promise<void> {
  try {
    const admin = createAdminClient();
    const lower = email.toLowerCase();
    const now = new Date().toISOString();

    const { data: c } = await admin.from("crm_contacts").select("id, name, tags, fields").eq("email", lower).maybeSingle();
    const ex = c as { id: string; name: string | null; tags: string[] | null; fields: Record<string, unknown> | null } | null;

    // Tag src:signup + status:customer; clear any nurturing tags.
    const nextTags = Array.from(new Set([...(ex?.tags ?? []), "src:signup", "status:customer"])).filter(
      (t) => t !== "status:nurturing" && t !== "status:nurture-finished"
    );
    const nextFields = { ...(ex?.fields ?? {}) };
    if (opts?.workspaceName) nextFields.workspace_name = opts.workspaceName;

    let contactId = ex?.id;
    const base: Record<string, unknown> = {
      stage: "signed_up",
      customer_at: now,
      tags: nextTags,
      fields: nextFields,
      last_activity_at: now,
      updated_at: now,
    };
    if (opts?.orgId) base.org_id = opts.orgId; // only set when known — never null out an existing link
    if (opts?.name) base.name = opts.name;

    if (contactId) {
      await admin.from("crm_contacts").update(base).eq("id", contactId);
    } else {
      const { data: created } = await admin
        .from("crm_contacts")
        .insert({ email: lower, first_source: "signup", ...base })
        .select("id")
        .single();
      contactId = (created as { id: string } | null)?.id;
    }

    if (contactId) {
      // Kill switch: stop any running nurture before starting onboarding.
      await stopEnrollments(contactId, "customer", admin);
      await admin.from("crm_activities").insert({ contact_id: contactId, kind: "system", body: "Became a customer — nurture stopped, onboarding started" });
      // Enroll in the signup onboarding sequence + the day-30 referral ask
      // (both are customer sequences — won-guards + one-at-a-time don't apply).
      await enrollContactInSource(contactId, lower, "signup", admin, { ignoreWonGuards: true });
      await enrollContactInSource(contactId, lower, "referral", admin, { ignoreWonGuards: true });
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
