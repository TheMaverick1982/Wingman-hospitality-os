"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { normalizeFormConfig } from "@/lib/application-form";
import { sendEmail } from "@/lib/email";
import { REPLY_KINDS, type ReplyKind, normalizeReplyTemplates, renderReplyTemplate } from "@/lib/applicant-reply";
import { wallClockToUtc } from "@/lib/timezone";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentProfile } from "@/lib/auth/profile";

const STATUSES = ["new", "contacted", "not_a_fit", "hired"] as const;
export type ApplicationStatus = (typeof STATUSES)[number];

async function gate() {
  const p = await getCurrentProfile();
  return p && canEditSection(p.accessRole, "hiring", p.permissionOverrides) ? p : null;
}

// The IANA zone an interview/visit time should be read in: the application's
// location, falling back to the manager's home location. A <input
// type="datetime-local"> gives a naive wall-clock string, so we must anchor it to
// THIS zone (the store's), not the UTC server, or the saved instant is off by the
// server's offset.
async function applicationTimezone(supabase: SupabaseClient, id: string, profile: CurrentProfile): Promise<string | null> {
  const { data } = await supabase.from("job_applications").select("location_id").eq("id", id).maybeSingle();
  const locId = (data as { location_id: string | null } | null)?.location_id ?? null;
  if (locId) {
    const { data: loc } = await supabase.from("locations").select("timezone").eq("id", locId).maybeSingle();
    const tz = (loc as { timezone: string | null } | null)?.timezone;
    if (tz) return tz;
  }
  return profile.locationTimezone ?? null;
}

export async function updateApplicationStatus(id: string, status: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  if (!STATUSES.includes(status as ApplicationStatus)) return { error: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Save a rejected applicant's note + "do not hire" flag. (The status is set to
// 'not_a_fit' separately via updateApplicationStatus.) Columns land with a
// migration, so this is best-effort until it's applied.
export async function saveRejectionDetails(id: string, note: string, doNotHire: boolean): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ rejection_note: (note || "").slice(0, 2000), do_not_hire: !!doNotHire, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Save the org's editable copy for the two applicant replies. Blank fields fall
// back to the built-in defaults (normalizeReplyTemplates), so a customer can't
// save an empty email.
export async function updateReplyTemplates(input: unknown): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const templates = normalizeReplyTemplates(input);
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const { error } = await supabase.from("organizations").update({ application_reply_templates: templates }).eq("id", (org as { id: string }).id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Email an applicant a canned reply, and record that it went out. The copy is the
// org's editable template (or the built-in default), addressed to the applicant
// by their first name — run through the name-safety filter so a junk/offensive
// name is never echoed back. Reply-to is the application's LOCATION email
// (falling back to the org's copy list), so a reply reaches the store, never
// Wingman. Also nudges status: 'not_a_fit' archives, 'interested' marks Reviewed.
export async function sendApplicantReply(id: string, kind: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  if (!REPLY_KINDS.includes(kind as ReplyKind)) return { error: "Invalid reply type." };
  const supabase = await createClient();

  const { data: appRow } = await supabase
    .from("job_applications")
    .select("id, name, email, department, location_id, org_id")
    .eq("id", id)
    .maybeSingle();
  const app = appRow as { id: string; name: string; email: string | null; department: string | null; location_id: string | null; org_id: string } | null;
  if (!app) return { error: "Application not found." };
  const to = (app.email || "").trim();
  if (!to.includes("@")) return { error: "This applicant didn't leave an email address, so there's no one to reply to." };

  // Org name + the (optionally customized) reply templates. Templates land with
  // migration 0173 — read in isolation so a not-yet-applied migration falls back
  // to the built-in defaults instead of erroring the send.
  const { data: orgRow } = await supabase.from("organizations").select("name, applications_cc").eq("id", app.org_id).maybeSingle();
  const org = orgRow as { name: string; applications_cc: string | null } | null;
  const orgName = (org?.name || "the team").trim();
  let storedTemplates: unknown = null;
  {
    const { data: tRow } = await supabase.from("organizations").select("application_reply_templates").eq("id", app.org_id).maybeSingle();
    storedTemplates = (tRow as { application_reply_templates?: unknown } | null)?.application_reply_templates ?? null;
  }
  const templates = normalizeReplyTemplates(storedTemplates);

  // Reply-to = the location's email so replies land in that store's inbox; fall
  // back to the first configured copy address if the location has none set.
  let replyTo = "";
  if (app.location_id) {
    const { data: loc } = await supabase.from("locations").select("email").eq("id", app.location_id).maybeSingle();
    replyTo = ((loc as { email?: string } | null)?.email || "").trim();
  }
  if (!replyTo) {
    replyTo = (org?.applications_cc || "").split(/[,\n;]+/).map((s) => s.trim()).find((s) => s.includes("@")) || "";
  }

  const { subject, html } = renderReplyTemplate(templates[kind as ReplyKind], {
    name: app.name || null,
    restaurant: orgName,
    role: app.department?.trim() || null,
  });
  // The From display name is the restaurant (the verified sending domain stays
  // updates.joinwingman.app); strip header-breaking characters.
  const fromName = orgName.replace(/["\\\r\n<>]/g, "").slice(0, 60) || "Hiring";

  try {
    await sendEmail({
      to: [to],
      subject,
      html,
      from: `${fromName} <reports@updates.joinwingman.app>`,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch {
    return { error: "Couldn't send the email just now. Please try again." };
  }

  const now = new Date().toISOString();
  await supabase.from("job_applications").update({ status: kind === "not_a_fit" ? "not_a_fit" : "contacted", updated_at: now }).eq("id", id);
  // Recording the send lives in columns added by migration 0172 — best-effort so
  // a not-yet-applied migration still lets the email + status update go through.
  await supabase.from("job_applications").update({ reply_sent_kind: kind, reply_sent_at: now }).eq("id", id);
  revalidatePath("/hiring");
  return { error: null };
}

// Confirm an interview: set the date/time + details and move the application
// into the candidates area (status 'interviewing').
export async function confirmInterview(id: string, when: string, details: string): Promise<{ error: string | null }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  if (!when) return { error: "Pick an interview date and time." };
  const supabase = await createClient();
  const tz = await applicationTimezone(supabase, id, profile);
  const iso = (wallClockToUtc(when, tz) ?? new Date(when)).toISOString();
  const { error } = await supabase
    .from("job_applications")
    .update({ interview_at: iso, interview_details: (details || "").slice(0, 2000), status: "interviewing", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Move a scheduled interview back to the applications list.
export async function unconfirmInterview(id: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ status: "contacted", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function scheduleApplicationVisit(id: string, when: string): Promise<{ error: string | null }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  const tz = when ? await applicationTimezone(supabase, id, profile) : null;
  const iso = when ? (wallClockToUtc(when, tz) ?? new Date(when)).toISOString() : null;
  const { error } = await supabase
    .from("job_applications")
    .update({ preferred_visit_at: iso, visit_confirmed: Boolean(iso), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// A short-lived signed URL to view a private resume (managers with Hiring
// access only). The row read is under RLS; the file is fetched via admin.
export async function getResumeUrl(id: string): Promise<{ url: string | null; error: string | null }> {
  if (!(await gate())) return { url: null, error: "Not authorized." };
  const supabase = await createClient();
  const { data } = await supabase.from("job_applications").select("resume_path").eq("id", id).maybeSingle();
  const path = (data as { resume_path: string | null } | null)?.resume_path;
  if (!path) return { url: null, error: "No resume on file." };
  const admin = createAdminClient();
  const { data: signed } = await admin.storage.from("resumes").createSignedUrl(path, 300);
  return { url: signed?.signedUrl ?? null, error: signed?.signedUrl ? null : "Couldn't open that resume." };
}

// Save the catch-all copy list (comma-separated emails) that every application
// notification is also sent to, on top of the location's email.
export async function updateApplicationsCc(value: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const cleaned = value
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"))
    .join(", ");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const { error } = await supabase.from("organizations").update({ applications_cc: cleaned }).eq("id", (org as { id: string }).id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Set a clean, custom "vanity" slug for the public application link
// (joinwingman.app/apply/<slug>). Validated and checked for uniqueness across all
// orgs (public_slug is globally unique). Changing it retires the old link.
const RESERVED_SLUGS = new Set(["apply", "embed", "admin", "api", "login", "signup", "wingman"]);
export async function updateApplySlug(value: string): Promise<{ error: string | null; slug?: string }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const slug = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9-]+$/.test(slug)) return { error: "Use only lowercase letters, numbers, and hyphens." };
  if (slug.length < 3 || slug.length > 40) return { error: "Keep it between 3 and 40 characters." };
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) return { error: "No leading, trailing, or double hyphens." };
  if (RESERVED_SLUGS.has(slug)) return { error: "That word is reserved — pick another." };

  const admin = createAdminClient();
  // Globally unique — check across orgs (RLS would only see our own).
  const { data: clash } = await admin.from("organizations").select("id").eq("public_slug", slug).maybeSingle();
  if (clash && (clash as { id: string }).id !== profile.orgId) {
    return { error: "That link is already taken — try another." };
  }
  const { error } = await admin.from("organizations").update({ public_slug: slug }).eq("id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null, slug };
}

// Upload (or replace) the org logo shown on the public application form.
export async function uploadOrgLogo(formData: FormData): Promise<{ error: string | null; url?: string }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "Choose an image first." };
  if (!file.type.startsWith("image/")) return { error: "Upload an image (PNG, JPG, or SVG)." };
  if (file.size > 3 * 1024 * 1024) return { error: "Logo is too large — 3MB max." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${profile.orgId}/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage.from("org-logos").upload(path, bytes, { contentType: file.type, upsert: true });
  if (up.error) return { error: "Couldn't upload that image. Try again." };
  const { data: pub } = admin.storage.from("org-logos").getPublicUrl(path);
  const url = pub.publicUrl;
  await admin.from("organizations").update({ logo_url: url }).eq("id", profile.orgId);
  revalidatePath("/hiring");
  return { error: null, url };
}

export async function removeOrgLogo(): Promise<{ error: string | null }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("organizations").update({ logo_url: null }).eq("id", profile.orgId);
  revalidatePath("/hiring");
  return { error: null };
}

// Save the customized application form (built-in field settings + custom questions).
export async function updateApplicationForm(config: unknown): Promise<{ error: string | null }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const clean = normalizeFormConfig(config);
  // A dropdown with no options can't be answered — guard before saving.
  const badDropdown = clean.custom.find((f) => f.type === "dropdown" && (!f.options || f.options.length === 0));
  if (badDropdown) return { error: `Add at least one choice to the "${badDropdown.label || "dropdown"}" question.` };
  const unlabeled = clean.custom.some((f) => !f.label.trim());
  if (unlabeled) return { error: "Give every custom question a label." };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ application_form_config: clean }).eq("id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function deleteApplication(id: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}
