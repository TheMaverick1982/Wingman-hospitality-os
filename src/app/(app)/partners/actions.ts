"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
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

  revalidatePath("/partners");
  return { error: null };
}

export async function deleteContact(contactId: string) {
  const { profile } = await requirePartnersAccess();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("partner_contacts").delete().eq("id", contactId);
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

  const { error } = await supabase.from("partner_activities").insert({
    org_id: profile.orgId,
    contact_id: contactId,
    location_id: (contact as { location_id: string | null }).location_id,
    activity_date: dateOk ? activityDate : new Date().toISOString().slice(0, 10),
    activity_type: activityType,
    notes: String(formData.get("notes") || "").trim().slice(0, 4000),
    revenue_cents: parseMoneyCents(String(formData.get("revenue") || "")),
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

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
