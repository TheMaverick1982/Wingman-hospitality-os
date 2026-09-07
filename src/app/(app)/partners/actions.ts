"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { logAudit } from "@/lib/audit-log";
import { logActivity as recordActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/email";
import type { PartnerActivityType } from "@/lib/partners";

export type ActionState = { error: string | null };

const ACTIVITY_VALUES: PartnerActivityType[] = ["call_text", "email", "meeting", "event_booked", "fundraiser_booked"];

// Dollars string -> integer cents, or null when blank/invalid.
function parseMoneyCents(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Only super_admin and manager reach Partners (nav + RLS both enforce it); this
// is the app-side gate so actions fail fast with a clear message.
async function requirePartnersAccess() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." as string, profile: null };
  if (profile.accessRole !== "super_admin" && profile.accessRole !== "manager") {
    return { error: "You don't have access to Partners." as string, profile: null };
  }
  return { error: null as string | null, profile };
}

export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: gate, profile } = await requirePartnersAccess();
  if (gate || !profile) return { error: gate ?? "Access denied." };

  const contactId = String(formData.get("contactId") || "") || null;
  const companyName = String(formData.get("company_name") || "").trim();
  if (!companyName) return { error: "Company / organization name is required." };

  // A manager must file the contact under a location they can reach; a
  // super_admin may also pick "Org-wide" (empty -> null). RLS re-checks this.
  const rawLocation = String(formData.get("location_id") || "");
  const locationId = rawLocation || null;
  if (profile.accessRole === "manager" && !locationId) {
    return { error: "Pick a location for this contact." };
  }

  const fields = {
    location_id: locationId,
    company_name: companyName.slice(0, 200),
    contact_name: String(formData.get("contact_name") || "").trim().slice(0, 200),
    title: String(formData.get("title") || "").trim().slice(0, 120),
    email: String(formData.get("email") || "").trim().slice(0, 200),
    phone: String(formData.get("phone") || "").trim().slice(0, 60),
    category: String(formData.get("category") || "").trim().slice(0, 80),
    subcategory: String(formData.get("subcategory") || "").trim().slice(0, 80),
    website: String(formData.get("website") || "").trim().slice(0, 300),
    address: String(formData.get("address") || "").trim().slice(0, 300),
    notes: String(formData.get("notes") || "").trim().slice(0, 4000),
  };

  const supabase = await createClient();

  if (contactId) {
    const { error } = await supabase
      .from("partner_contacts")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", contactId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("partner_contacts")
      .insert({ ...fields, org_id: profile.orgId, created_by: profile.userId, status: "active" });
    if (error) return { error: error.message };
  }

  await recordActivity({ orgId: profile.orgId, actorId: profile.userId, actorName: profile.fullName, area: "partners", action: contactId ? "updated" : "created", label: companyName });
  revalidatePath("/partners");
  return { error: null };
}

// Soft delete — hidden by RLS but recoverable by the owner from Settings → Trash.
export async function deleteContact(contactId: string) {
  const { profile } = await requirePartnersAccess();
  if (!profile) return;
  const supabase = await createClient();
  const { data: c } = await supabase.from("partner_contacts").select("company_name").eq("id", contactId).maybeSingle();
  await supabase
    .from("partner_contacts")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.userId })
    .eq("id", contactId);
  await logAudit({
    orgId: profile.orgId,
    actorId: profile.userId,
    actorName: profile.fullName,
    action: "deleted",
    entityType: "partner",
    entityId: contactId,
    entityLabel: (c as { company_name?: string } | null)?.company_name ?? "",
  });
  await recordActivity({ orgId: profile.orgId, actorId: profile.userId, actorName: profile.fullName, area: "partners", action: "deleted", label: (c as { company_name?: string } | null)?.company_name ?? "" });
  revalidatePath("/partners");
}

export async function logActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: gate, profile } = await requirePartnersAccess();
  if (gate || !profile) return { error: gate ?? "Access denied." };

  const contactId = String(formData.get("contact_id") || "");
  if (!contactId) return { error: "Pick a contact." };

  const activityType = String(formData.get("activity_type") || "") as PartnerActivityType;
  if (!ACTIVITY_VALUES.includes(activityType)) return { error: "Pick an activity type." };

  const activityDate = String(formData.get("activity_date") || "").trim();
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(activityDate);

  const supabase = await createClient();
  // Copy location from the contact (source of truth) rather than trusting the
  // client; also confirms the caller can actually see this contact.
  const { data: contact } = await supabase
    .from("partner_contacts")
    .select("id, location_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { error: "That contact could not be found." };

  const contactLocation = (contact as { location_id: string | null }).location_id;
  const { error } = await supabase.from("partner_activities").insert({
    org_id: profile.orgId,
    contact_id: contactId,
    location_id: contactLocation,
    activity_date: dateOk ? activityDate : new Date().toISOString().slice(0, 10),
    activity_type: activityType,
    notes: String(formData.get("notes") || "").trim().slice(0, 4000),
    revenue_cents: parseMoneyCents(String(formData.get("revenue") || "")),
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

  // Optional follow-up task → its own row; a daily cron emails the assignee
  // (the creator) when it comes due.
  if (formData.get("create_followup") === "on") {
    const followupDate = String(formData.get("followup_date") || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(followupDate)) {
      await supabase.from("partner_follow_ups").insert({
        org_id: profile.orgId,
        contact_id: contactId,
        location_id: contactLocation,
        assigned_to: profile.userId,
        due_date: followupDate,
        notes: String(formData.get("followup_notes") || "").trim().slice(0, 2000),
        created_by: profile.userId,
      });
    }
  }

  revalidatePath("/partners");
  return { error: null };
}

// One-tap "Log Call/Text" from a contact row: records a call_text dated today,
// which resets the 30-day fading clock via the last_activity_at trigger.
export async function quickLogCallText(contactId: string) {
  const { profile } = await requirePartnersAccess();
  if (!profile) return;
  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("partner_contacts")
    .select("id, location_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return;
  await supabase.from("partner_activities").insert({
    org_id: profile.orgId,
    contact_id: contactId,
    location_id: (contact as { location_id: string | null }).location_id,
    activity_date: new Date().toISOString().slice(0, 10),
    activity_type: "call_text",
    notes: "",
    created_by: profile.userId,
  });
  revalidatePath("/partners");
}

// Load the contact's location (source of truth) and confirm the caller can see it.
async function contactLocation(supabase: Awaited<ReturnType<typeof createClient>>, contactId: string): Promise<{ location_id: string | null } | null> {
  const { data } = await supabase.from("partner_contacts").select("id, location_id").eq("id", contactId).maybeSingle();
  return data ? { location_id: (data as { location_id: string | null }).location_id } : null;
}

// Add a dated note to a contact's timeline (a 'note' activity). Notes stack as
// history rather than overwriting the contact's single "about" notes field.
export async function addContactNote(contactId: string, note: string): Promise<ActionState> {
  const { error: gate, profile } = await requirePartnersAccess();
  if (gate || !profile) return { error: gate ?? "Access denied." };
  const text = note.trim();
  if (!text) return { error: "Write a note first." };
  const supabase = await createClient();
  const contact = await contactLocation(supabase, contactId);
  if (!contact) return { error: "That contact could not be found." };
  const { error } = await supabase.from("partner_activities").insert({
    org_id: profile.orgId,
    contact_id: contactId,
    location_id: contact.location_id,
    activity_date: new Date().toISOString().slice(0, 10),
    activity_type: "note",
    notes: text.slice(0, 4000),
    created_by: profile.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/partners");
  return { error: null };
}

// Schedule a reach-out (a follow-up task with a due date). The existing daily
// cron emails the creator when it comes due.
export async function scheduleReachOut(contactId: string, dueDate: string, note: string): Promise<ActionState> {
  const { error: gate, profile } = await requirePartnersAccess();
  if (gate || !profile) return { error: gate ?? "Access denied." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "Pick a date for the reach-out." };
  const supabase = await createClient();
  const contact = await contactLocation(supabase, contactId);
  if (!contact) return { error: "That contact could not be found." };
  const { error } = await supabase.from("partner_follow_ups").insert({
    org_id: profile.orgId,
    contact_id: contactId,
    location_id: contact.location_id,
    assigned_to: profile.userId,
    due_date: dueDate,
    notes: (note || "").trim().slice(0, 2000),
    created_by: profile.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/partners");
  return { error: null };
}

// Mark a scheduled reach-out done (scoped to this org via RLS).
export async function completeReachOut(followUpId: string): Promise<ActionState> {
  const { error: gate, profile } = await requirePartnersAccess();
  if (gate || !profile) return { error: gate ?? "Access denied." };
  const supabase = await createClient();
  const { error } = await supabase.from("partner_follow_ups").update({ done: true }).eq("id", followUpId).eq("org_id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/partners");
  return { error: null };
}

// Email a partner contact from inside Wingman and log it to their timeline. Sent
// from the rep's name; reply-to is the rep's own email so the contact's reply
// comes straight back to them, not to Wingman.
export async function sendContactEmail(contactId: string, subject: string, body: string): Promise<ActionState> {
  const { error: gate, profile } = await requirePartnersAccess();
  if (gate || !profile) return { error: gate ?? "Access denied." };
  const subj = subject.trim();
  const msg = body.trim();
  if (!subj) return { error: "Add a subject." };
  if (!msg) return { error: "Write a message." };

  const supabase = await createClient();
  const { data: c } = await supabase.from("partner_contacts").select("id, location_id, email, contact_name, company_name").eq("id", contactId).maybeSingle();
  const contact = c as { location_id: string | null; email: string | null; contact_name: string | null; company_name: string } | null;
  if (!contact) return { error: "That contact could not be found." };
  const to = (contact.email || "").trim();
  if (!to.includes("@")) return { error: "This contact has no email address on file. Add one first." };

  const fromName = (profile.fullName || profile.orgName || "Wingman").replace(/["\\\r\n<>]/g, "").slice(0, 60) || "Wingman";
  const replyTo = (profile.email || "").trim();
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.6;max-width:560px;">${msg
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("")}</div>`;

  try {
    await sendEmail({
      to: [to],
      subject: subj.slice(0, 200),
      html,
      from: `${fromName} <reports@updates.joinwingman.app>`,
      ...(replyTo.includes("@") ? { replyTo } : {}),
    });
  } catch {
    return { error: "Couldn't send the email just now. Please try again." };
  }

  // Log it on the contact's timeline as an email touch (resets the fading clock).
  await supabase.from("partner_activities").insert({
    org_id: profile.orgId,
    contact_id: contactId,
    location_id: contact.location_id,
    activity_date: new Date().toISOString().slice(0, 10),
    activity_type: "email",
    notes: `Subject: ${subj}\n\n${msg}`.slice(0, 4000),
    created_by: profile.userId,
  });
  revalidatePath("/partners");
  return { error: null };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
}
